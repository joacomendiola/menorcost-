import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MailerService } from '../auth/mailer/mailer.service.js';
import type { EnvioCorreo } from '../auth/mailer/mailer.interface.js';

const USUARIO_PUBLICO_SELECT = {
  id: true,
  dni: true,
  nombre: true,
  apellido: true,
  email: true,
  telefono: true,
  rol: true,
  estado: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class BackofficeService {
  private readonly logger = new Logger(BackofficeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailerService: MailerService,
  ) {}

  private async enviarCorreoSeguro(correo: EnvioCorreo): Promise<{
    enviada: boolean;
    aviso?: string;
  }> {
    try {
      await this.mailerService.enviar(correo);
      return { enviada: true };
    } catch (error: unknown) {
      const detalle = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `La acción administrativa se guardó, pero falló el envío de correo a ${correo.to}: ${detalle}`,
      );
      return {
        enviada: false,
        aviso:
          'El cambio de estado se aplicó correctamente, pero no se pudo enviar el correo de notificación.',
      };
    }
  }

  // --- 1. MÉTRICAS (KPIs) ---
  async getKpis() {
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);

    const [altasPendientes, altasAprobadas, bajasSolicitadas, denunciasAbiertas] = await Promise.all([
      this.prisma.usuario.count({
        where: { rol: 'COMERCIANTE', estado: 'PENDIENTE_VERIFICACION', deletedAt: null },
      }),
      this.prisma.usuario.count({
        where: { rol: 'COMERCIANTE', estado: 'HABILITADO', createdAt: { gte: hace30Dias }, deletedAt: null },
      }),
      this.prisma.solicitudBaja.count({
        where: { estado: 'PENDIENTE' },
      }),
      this.prisma.reporte.count({
        where: { estado_reporte: { in: ['PENDIENTE_REVISION', 'BAJO_INVESTIGACION'] } },
      }),
    ]);

    return {
      altasPendientes,
      altasAprobadas30Dias: altasAprobadas,
      bajasSolicitadas,
      denunciasAbiertas,
    };
  }

  // --- 2. SOLICITUDES DE ALTA ---
  async listarAltas(search?: string, estado?: string) {
    const whereUsuario: any = { rol: 'COMERCIANTE', deletedAt: null };

    if (estado && estado !== 'todos') {
      whereUsuario.estado = estado;
    }

    // La búsqueda de altas permite matchear por datos del usuario o por CUIT.
    // El filtro de estado se respeta en ambas ramas.
    const where: any = search
      ? {
          OR: [
            {
              usuario: {
                ...whereUsuario,
                OR: [
                  { dni: { contains: search, mode: 'insensitive' } },
                  { nombre: { contains: search, mode: 'insensitive' } },
                  { apellido: { contains: search, mode: 'insensitive' } },
                  { email: { contains: search, mode: 'insensitive' } },
                ],
              },
            },
            {
              usuario: whereUsuario,
              cuit: { contains: search, mode: 'insensitive' },
            },
          ],
        }
      : { usuario: whereUsuario };

    return this.prisma.comercio.findMany({
      where,
      include: {
        usuario: {
          select: {
            ...USUARIO_PUBLICO_SELECT,
            direcciones: true,
          },
        },
      },
    });
  }

  async aprobarAlta(idComercio: string) {
    const comercio = await this.prisma.comercio.findUnique({
      where: { idComercio },
      include: {
        usuario: {
          select: {
            ...USUARIO_PUBLICO_SELECT,
            deletedAt: true,
          },
        },
      },
    });

    if (!comercio || comercio.usuario.deletedAt !== null) {
      throw new NotFoundException('Comercio no encontrado');
    }

    // Escritura atómica: habilita usuario Y comercio en la misma transacción
    await this.prisma.$transaction(async (tx) => {
      const usuarioOk = await tx.usuario.updateMany({
        where: {
          id: comercio.userId,
          estado: 'PENDIENTE_VERIFICACION',
          deletedAt: null,
        },
        data: { estado: 'HABILITADO' },
      });

      const comercioOk = await tx.comercio.updateMany({
        where: {
          idComercio: idComercio,
          estado: 'PENDIENTE_VERIFICACION',
        },
        data: { estado: 'HABILITADO' },
      });

      // Si una de las dos filas no estaba pendiente, se revierte todo.
      if (usuarioOk.count === 0 || comercioOk.count === 0) {
        throw new ConflictException(
          'La solicitud de alta ya no está pendiente de verificación o fue procesada por otro administrador',
        );
      }
    });

    const actualizado = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: comercio.userId },
      select: USUARIO_PUBLICO_SELECT,
    });

    const notificacion = await this.enviarCorreoSeguro({
      to: comercio.usuario.email,
      subject: '¡Bienvenido a Menorcost! Tu cuenta ha sido habilitada',
      html: `<p>Hola <strong>${comercio.usuario.nombre}</strong>,</p>
             <p>Nos alegra informarte que tu comercio ha superado la auditoría y ya está <strong>HABILITADO</strong> en nuestra plataforma.</p>
             <p>¡Ya puedes comenzar a publicar tus ofertas!</p>`,
    });

    return {
      ...actualizado,
      notificacion,
    };
  }

  async rechazarAlta(idComercio: string, motivo: string) {
    const comercio = await this.prisma.comercio.findUnique({
      where: { idComercio },
      include: {
        usuario: {
          select: {
            ...USUARIO_PUBLICO_SELECT,
            deletedAt: true,
          },
        },
      },
    });

    if (!comercio || comercio.usuario.deletedAt !== null) {
      throw new NotFoundException('Comercio no encontrado');
    }

    // Escritura atómica: rechaza usuario Y comercio en la misma transacción
    await this.prisma.$transaction(async (tx) => {
      const usuarioOk = await tx.usuario.updateMany({
        where: {
          id: comercio.userId,
          estado: 'PENDIENTE_VERIFICACION',
          deletedAt: null,
        },
        data: { estado: 'DOCUMENTACION_RECHAZADA' },
      });

      const comercioOk = await tx.comercio.updateMany({
        where: {
          idComercio: idComercio,
          estado: 'PENDIENTE_VERIFICACION',
        },
        data: { estado: 'DOCUMENTACION_RECHAZADA' },
      });

      // Si una de las dos filas no estaba pendiente, se revierte todo.
      if (usuarioOk.count === 0 || comercioOk.count === 0) {
        throw new ConflictException(
          'La solicitud de alta ya no está pendiente de verificación o fue procesada por otro administrador',
        );
      }
    });

    const actualizado = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: comercio.userId },
      select: USUARIO_PUBLICO_SELECT,
    });

    const notificacion = await this.enviarCorreoSeguro({
      to: comercio.usuario.email,
      subject: 'Actualización sobre tu solicitud en Menorcost',
      html: `<p>Hola <strong>${comercio.usuario.nombre}</strong>,</p>
             <p>Hemos revisado tu documentación, pero lamentablemente tu solicitud ha sido rechazada por el siguiente motivo:</p>
             <blockquote><em>${motivo}</em></blockquote>
             <p>Por favor, corrige estos detalles y vuelve a intentarlo.</p>`,
    });

    return {
      ...actualizado,
      notificacion,
    };
  }

  // --- 3. DENUNCIAS Y MODERACIÓN ---
  async listarDenuncias(search?: string, estado?: string) {
    const whereClause: any = {};

    if (estado && estado !== 'todos') {
      whereClause.estado_reporte = estado;
    }

    if (search) {
      whereClause.OR = [
        { motivo: { contains: search, mode: 'insensitive' } },
        { denunciado: { email: { contains: search, mode: 'insensitive' } } },
        { denunciado: { nombre: { contains: search, mode: 'insensitive' } } },
        { denunciado: { apellido: { contains: search, mode: 'insensitive' } } },
        { denunciado: { comercio: { cuit: { contains: search, mode: 'insensitive' } } } },
        {
          denunciado: {
            comercio: { razonSocial: { contains: search, mode: 'insensitive' } },
          },
        },
        {
          denunciado: {
            comercio: { nombreFantasia: { contains: search, mode: 'insensitive' } },
          },
        },
        { emisor: { email: { contains: search, mode: 'insensitive' } } },
        { emisor: { nombre: { contains: search, mode: 'insensitive' } } },
        { emisor: { apellido: { contains: search, mode: 'insensitive' } } },
        { emisor: { comercio: { cuit: { contains: search, mode: 'insensitive' } } } },
        {
          emisor: {
            comercio: { razonSocial: { contains: search, mode: 'insensitive' } },
          },
        },
        {
          emisor: {
            comercio: { nombreFantasia: { contains: search, mode: 'insensitive' } },
          },
        },
      ];
    }

    const reportes = await this.prisma.reporte.findMany({
      where: whereClause,
      include: {
        pedido: {
          include: {
            items: {
              include: { producto: { select: { titulo: true } } },
            },
          },
        },
        emisor: { select: USUARIO_PUBLICO_SELECT },
        denunciado: {
          select: {
            ...USUARIO_PUBLICO_SELECT,
            comercio: {
              select: {
                cuit: true,
                razonSocial: true,
                nombreFantasia: true,
              },
            },
          },
        },
        admin: { select: USUARIO_PUBLICO_SELECT },
      },
      orderBy: [
        { denunciado: { estado: 'desc' } },
        { fecha_reporte: 'desc' },
      ],
    });

    const idsDenunciados = [...new Set(reportes.map((r) => r.id_denunciado))];
    const grupos =
      idsDenunciados.length > 0
        ? await this.prisma.reporte.groupBy({
            by: ['id_denunciado', 'estado_reporte'],
            where: { id_denunciado: { in: idsDenunciados } },
            _count: { _all: true },
          })
        : [];

    const registro = new Map<
      string,
      { total: number; abiertas: number; resueltas: number; desestimadas: number }
    >();
    for (const id of idsDenunciados) {
      registro.set(id, { total: 0, abiertas: 0, resueltas: 0, desestimadas: 0 });
    }
    for (const grupo of grupos) {
      const actual = registro.get(grupo.id_denunciado);
      if (!actual) continue;
      const cantidad = grupo._count._all;
      actual.total += cantidad;
      if (
        grupo.estado_reporte === 'PENDIENTE_REVISION' ||
        grupo.estado_reporte === 'BAJO_INVESTIGACION'
      ) {
        actual.abiertas += cantidad;
      } else if (grupo.estado_reporte === 'RESUELTO') {
        actual.resueltas += cantidad;
      } else {
        actual.desestimadas += cantidad;
      }
    }

    return reportes.map((r) => ({
      ...r,
      registro: registro.get(r.id_denunciado) ?? {
        total: 0,
        abiertas: 0,
        resueltas: 0,
        desestimadas: 0,
      },
    }));
  }

  async alternarInvestigacion(idReporte: number) {
    const reporte = await this.prisma.reporte.findUnique({
      where: { id_reporte: idReporte },
      include: { denunciado: { select: USUARIO_PUBLICO_SELECT } },
    });
    if (!reporte) throw new NotFoundException('Reporte no encontrado');

    if (['RESUELTO', 'DESESTIMADO'].includes(reporte.estado_reporte)) {
      throw new BadRequestException('No se puede alterar la investigación de un reporte cerrado');
    }

    const estadoEsperado = reporte.estado_reporte;
    const nuevoEstado =
      estadoEsperado === 'PENDIENTE_REVISION' ? 'BAJO_INVESTIGACION' : 'PENDIENTE_REVISION';

    return this.prisma.$transaction(async (tx) => {
      const actualizados = await tx.reporte.updateMany({
        where: { id_reporte: idReporte, estado_reporte: estadoEsperado },
        data: { estado_reporte: nuevoEstado },
      });

      if (actualizados.count === 0) {
        throw new ConflictException('El estado del reporte fue modificado por otro administrador');
      }

      if (nuevoEstado === 'PENDIENTE_REVISION' && reporte.denunciado.estado === 'BAJO_INVESTIGACION') {
        const otrosReportesAbiertos = await tx.reporte.count({
          where: {
            id_denunciado: reporte.id_denunciado,
            estado_reporte: 'BAJO_INVESTIGACION',
            id_reporte: { not: idReporte },
          },
        });

        if (otrosReportesAbiertos === 0) {
          await tx.usuario.updateMany({
            where: { id: reporte.id_denunciado, estado: 'BAJO_INVESTIGACION' },
            data: { estado: 'HABILITADO' },
          });
        }
      } else if (nuevoEstado === 'BAJO_INVESTIGACION' && reporte.denunciado.estado === 'HABILITADO') {
        await tx.usuario.updateMany({
          where: { id: reporte.id_denunciado, estado: 'HABILITADO' },
          data: { estado: 'BAJO_INVESTIGACION' },
        });
      }

      return tx.reporte.findUniqueOrThrow({ where: { id_reporte: idReporte } });
    });
  }

  // Desestima la denuncia: el conflicto se resolvió externamente y no corresponde sanción.
  async desestimar(idReporte: number, idAdmin: string) {
    return this.cerrarReporte(idReporte, idAdmin, 'DESESTIMADO');
  }

  // Resuelve la denuncia sin sancionar al denunciado (queda registrada como RESUELTO).
  async resolver(idReporte: number, idAdmin: string) {
    return this.cerrarReporte(idReporte, idAdmin, 'RESUELTO');
  }

  private async cerrarReporte(
    idReporte: number,
    idAdmin: string,
    estadoFinal: 'RESUELTO' | 'DESESTIMADO',
  ) {
    const reporte = await this.prisma.reporte.findUnique({
      where: { id_reporte: idReporte },
      include: { denunciado: { select: USUARIO_PUBLICO_SELECT } },
    });
    if (!reporte) throw new NotFoundException('Reporte no encontrado');

    if (['RESUELTO', 'DESESTIMADO'].includes(reporte.estado_reporte)) {
      throw new BadRequestException('El reporte ya fue cerrado previamente');
    }

    return this.prisma.$transaction(async (tx) => {
      const actualizados = await tx.reporte.updateMany({
        where: {
          id_reporte: idReporte,
          estado_reporte: { in: ['PENDIENTE_REVISION', 'BAJO_INVESTIGACION'] },
        },
        data: {
          estado_reporte: estadoFinal,
          id_admin: idAdmin,
          fecha_resolucion: new Date(),
        },
      });

      if (actualizados.count === 0) {
        throw new ConflictException('El reporte ya fue cerrado por otro administrador');
      }

      await this.restaurarSiCorresponde(tx, reporte.id_denunciado, idReporte);

      return { success: true };
    });
  }

  // Restaura a HABILITADO si el denunciado ya no tiene reportes abiertos.
  private async restaurarSiCorresponde(
    tx: any,
    idDenunciado: string,
    idReporteExcluido: number,
  ) {
    const denunciado = await tx.usuario.findUnique({
      where: { id: idDenunciado },
      select: { estado: true },
    });
    if (denunciado?.estado !== 'BAJO_INVESTIGACION') return;

    const otrosAbiertos = await tx.reporte.count({
      where: {
        id_denunciado: idDenunciado,
        estado_reporte: { in: ['PENDIENTE_REVISION', 'BAJO_INVESTIGACION'] },
        id_reporte: { not: idReporteExcluido },
      },
    });

    if (otrosAbiertos === 0) {
      await tx.usuario.updateMany({
        where: { id: idDenunciado, estado: 'BAJO_INVESTIGACION' },
        data: { estado: 'HABILITADO' },
      });
    }
  }

  async sancionar(idReporte: number, idAdmin: string) {
    const reporte = await this.prisma.reporte.findUnique({
      where: { id_reporte: idReporte },
      include: { denunciado: { select: USUARIO_PUBLICO_SELECT } },
    });

    if (!reporte) throw new NotFoundException('Reporte no encontrado');

    if (['RESUELTO', 'DESESTIMADO'].includes(reporte.estado_reporte)) {
      throw new BadRequestException('El reporte ya fue cerrado previamente');
    }

    const {
      reporteActualizado,
      usuarioSuspendido,
      comercioSuspendido,
      denunciasCerradas,
    } = await this.prisma.$transaction(async (tx) => {
      const actualizados = await tx.reporte.updateMany({
        where: {
          id_reporte: idReporte,
          estado_reporte: { in: ['PENDIENTE_REVISION', 'BAJO_INVESTIGACION'] },
        },
        data: {
          estado_reporte: 'RESUELTO',
          id_admin: idAdmin,
          fecha_resolucion: new Date(),
        },
      });

      if (actualizados.count === 0) {
        throw new ConflictException('El reporte ya fue cerrado por otro administrador');
      }

      // La sanción cierra también las demás denuncias abiertas del mismo usuario.
      const otrosReportes = await tx.reporte.updateMany({
        where: {
          id_denunciado: reporte.id_denunciado,
          id_reporte: { not: idReporte },
          estado_reporte: { in: ['PENDIENTE_REVISION', 'BAJO_INVESTIGACION'] },
        },
        data: {
          estado_reporte: 'RESUELTO',
          id_admin: idAdmin,
          fecha_resolucion: new Date(),
        },
      });

      const usuario = await tx.usuario.update({
        where: { id: reporte.id_denunciado },
        data: {
          estado: 'SUSPENDIDO',
          tokenVersion: { increment: 1 },
        },
        select: USUARIO_PUBLICO_SELECT,
      });

      // Si el denunciado es comerciante, suspender también el local para que
      // desaparezca de la tienda pública (obtenerPublico exige estado HABILITADO).
      let comercioSuspendido = false;
      if (usuario.rol === 'COMERCIANTE') {
        const comercio = await tx.comercio.updateMany({
          where: { userId: usuario.id, estado: { not: 'SUSPENDIDO' } },
          data: { estado: 'SUSPENDIDO' },
        });
        comercioSuspendido = comercio.count > 0;
      }

      const rep = await tx.reporte.findUniqueOrThrow({
        where: { id_reporte: idReporte },
      });

      return {
        reporteActualizado: rep,
        usuarioSuspendido: usuario,
        comercioSuspendido,
        denunciasCerradas: otrosReportes.count,
      };
    });

    const notificacion = await this.enviarCorreoSeguro({
      to: reporte.denunciado.email,
      subject: 'Notificación Importante: Suspensión de Cuenta',
      html: `<p>Estimado usuario,</p>
             <p>Le informamos que, tras investigar el reporte #${idReporte}, la administración ha resuelto <strong>SUSPENDER</strong> su cuenta por incumplimiento de las políticas de Menorcost.</p>`,
    });

    return {
      reporte: reporteActualizado,
      usuario: usuarioSuspendido,
      comercioSuspendido,
      denunciasCerradas,
      notificacion,
    };
  }

  // Rehabilita una cuenta suspendida o bajo investigación (y su comercio asociado).
  async rehabilitarUsuario(idUsuario: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: idUsuario },
    });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    if (!['SUSPENDIDO', 'BAJO_INVESTIGACION'].includes(usuario.estado)) {
      throw new BadRequestException(
        'El usuario no está suspendido ni bajo investigación',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.usuario.update({
        where: { id: idUsuario },
        data: { estado: 'HABILITADO' },
        select: USUARIO_PUBLICO_SELECT,
      });

      if (usuario.rol === 'COMERCIANTE') {
        await tx.comercio.updateMany({
          where: { userId: idUsuario, estado: 'SUSPENDIDO' },
          data: { estado: 'HABILITADO' },
        });
      }

      return actualizado;
    });
  }
}