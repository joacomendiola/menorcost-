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

    if (search) {
      whereUsuario.OR = [
        { dni: { contains: search, mode: 'insensitive' } },
        { nombre: { contains: search, mode: 'insensitive' } },
        { apellido: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.comercio.findMany({
      where: { usuario: whereUsuario },
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

    // Escritura atómica condicionada a que siga en PENDIENTE_VERIFICACION
    const resultado = await this.prisma.usuario.updateMany({
      where: {
        id: comercio.userId,
        estado: 'PENDIENTE_VERIFICACION',
        deletedAt: null,
      },
      data: { estado: 'HABILITADO' },
    });

    if (resultado.count === 0) {
      throw new ConflictException(
        'La solicitud de alta ya no está pendiente de verificación o fue procesada por otro administrador',
      );
    }

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

    // Escritura atómica condicionada a que siga en PENDIENTE_VERIFICACION
    const resultado = await this.prisma.usuario.updateMany({
      where: {
        id: comercio.userId,
        estado: 'PENDIENTE_VERIFICACION',
        deletedAt: null,
      },
      data: { estado: 'DOCUMENTACION_RECHAZADA' },
    });

    if (resultado.count === 0) {
      throw new ConflictException(
        'La solicitud de alta ya no está pendiente de verificación o fue procesada por otro administrador',
      );
    }

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
      ];
    }

    return this.prisma.reporte.findMany({
      where: whereClause,
      include: {
        pedido: true,
        emisor: { select: USUARIO_PUBLICO_SELECT },
        denunciado: { select: USUARIO_PUBLICO_SELECT },
        admin: { select: USUARIO_PUBLICO_SELECT },
      },
      orderBy: [
        { denunciado: { estado: 'desc' } },
        { fecha_reporte: 'desc' },
      ],
    });
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

  async marcarResuelto(idReporte: number, idAdmin: string) {
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
          estado_reporte: 'DESESTIMADO',
          id_admin: idAdmin,
          fecha_resolucion: new Date(),
        },
      });

      if (actualizados.count === 0) {
        throw new ConflictException('El reporte ya fue cerrado por otro administrador');
      }

      if (reporte.denunciado.estado === 'BAJO_INVESTIGACION') {
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
      }

      return { success: true };
    });
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

    const { reporteActualizado, usuarioSuspendido } = await this.prisma.$transaction(async (tx) => {
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

      const usuario = await tx.usuario.update({
        where: { id: reporte.id_denunciado },
        data: {
          estado: 'SUSPENDIDO',
          tokenVersion: { increment: 1 },
        },
        select: USUARIO_PUBLICO_SELECT,
      });

      const rep = await tx.reporte.findUniqueOrThrow({
        where: { id_reporte: idReporte },
      });

      return { reporteActualizado: rep, usuarioSuspendido: usuario };
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
      notificacion,
    };
  }
}