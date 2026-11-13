import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MailerService } from '../auth/mailer/mailer.service.js';
import type { EnvioCorreo } from '../auth/mailer/mailer.interface.js';
import type { CrearReporteDto } from './dto/crear-reporte.dto.js';
import type { ListarMisReportesQueryDto } from './dto/listar-mis-reportes-query.dto.js';
import type {
  EstadoPedido,
  TipoDestinoReporte,
  Rol,
} from '../../generated/prisma/enums.js';
import type { Prisma } from '../../generated/prisma/client.js';

const ESTADOS_REPORTES_ABIERTOS = [
  'PENDIENTE_REVISION',
  'BAJO_INVESTIGACION',
] as const;

const ESTADOS_REPORTABLES: Record<Rol, EstadoPedido[]> = {
  CLIENTE: ['ENTREGADO', 'PENDIENTE_DE_RETIRO', 'CANCELADO'],
  COMERCIANTE: [
    'ENTREGADO',
    'PENDIENTE_DE_RETIRO',
    'CANCELADO',
    'CANCELADO_POR_FALTA_RETIRO',
  ],
  ADMINISTRADOR: [],
};

function escaparHtml(valor: string): string {
  return valor.replace(/[&<>"']/g, (caracter) => {
    const entidades: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entidades[caracter];
  });
}

@Injectable()
export class ReportesService {
  private readonly logger = new Logger(ReportesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailerService: MailerService,
  ) {}

  async crearReporte(idUsuario: string, rolUsuario: Rol, dto: CrearReporteDto) {
    if (rolUsuario !== 'CLIENTE' && rolUsuario !== 'COMERCIANTE') {
      throw new ForbiddenException('Solo clientes y comerciantes pueden crear reportes');
    }

    const esOtroMotivo = dto.motivo.toLowerCase().includes('otro');
    if (esOtroMotivo && (!dto.descripcion || dto.descripcion.trim() === '')) {
      throw new BadRequestException('Por favor, especifica brevemente el problema ocurrido');
    }

    try {
      const reporte = await this.prisma.$transaction(
        async (tx) => {
          const [emisor, pedido] = await Promise.all([
            tx.usuario.findUnique({
              where: { id: idUsuario },
              select: { estado: true, deletedAt: true },
            }),
            tx.pedido.findUnique({
              where: { id_pedido: dto.idPedido },
              include: {
                comercio: { include: { usuario: { select: { id: true } } } },
              },
            }),
          ]);

          if (!emisor || emisor.deletedAt !== null || emisor.estado !== 'HABILITADO') {
            throw new ForbiddenException('La cuenta no está habilitada para crear reportes');
          }
          if (!pedido) {
            throw new NotFoundException('Pedido no encontrado');
          }
          if (!pedido.comercio) {
            throw new NotFoundException('Comercio asociado al pedido no encontrado');
          }

          let idDenunciado: string;
          let tipoDestinoEsperado: TipoDestinoReporte;

          if (rolUsuario === 'CLIENTE') {
            if (pedido.usuarioId !== idUsuario) {
              throw new ForbiddenException('No puedes reportar un pedido que no te pertenece');
            }
            idDenunciado = pedido.comercio.usuario.id;
            tipoDestinoEsperado = 'COMERCIO';
          } else {
            if (pedido.comercio.usuario.id !== idUsuario) {
              throw new ForbiddenException('No puedes reportar un pedido de otro comercio');
            }
            idDenunciado = pedido.usuarioId;
            tipoDestinoEsperado = 'CLIENTE';
          }

          if (!ESTADOS_REPORTABLES[rolUsuario].includes(pedido.estado)) {
            throw new BadRequestException(
              `No se puede reportar un pedido en estado ${pedido.estado}`,
            );
          }
          if (dto.tipo_destino !== tipoDestinoEsperado) {
            throw new BadRequestException('El tipo de destino no corresponde a tu rol');
          }

          const reporteExistente = await tx.reporte.findFirst({
            where: {
              id_pedido: dto.idPedido,
              id_emisor: idUsuario,
              estado_reporte: { in: [...ESTADOS_REPORTES_ABIERTOS] },
            },
            select: { id_reporte: true },
          });
          if (reporteExistente) {
            throw new ConflictException(
              'Ya existe un reporte en revisión emitido por ti para este pedido',
            );
          }

          const reporte = await tx.reporte.create({
            data: {
              id_pedido: dto.idPedido,
              motivo: dto.motivo,
              descripcion: dto.descripcion,
              estado_reporte: 'PENDIENTE_REVISION',
              tipo_destino: dto.tipo_destino,
              id_emisor: idUsuario,
              id_denunciado: idDenunciado,
            },
            include: {
              pedido: { select: { id_pedido: true, estado: true } },
              emisor: { select: { id: true, nombre: true, apellido: true, email: true } },
              denunciado: { select: { id: true, nombre: true, apellido: true, email: true } },
            },
          });

          await this.verificarUmbralReportes(tx, idDenunciado);
          return reporte;
        },
        { isolationLevel: 'Serializable' },
      );

      const notificacionSoporte = await this.notificarSoporte(reporte);
      return { ...reporte, notificacionSoporte };
    } catch (error: unknown) {
      const codigo =
        error && typeof error === 'object' && 'code' in error
          ? (error as { code?: string }).code
          : undefined;

      if (codigo === 'P2034') {
        throw new ConflictException(
          'El reporte entró en conflicto con otra operación. Inténtalo nuevamente.',
        );
      }
      if (codigo === 'P2002') {
        throw new ConflictException(
          'Ya existe un reporte en revisión emitido por ti para este pedido',
        );
      }
      throw error;
    }
  }

  private async notificarSoporte(reporte: {
    id_reporte: number;
    id_pedido: string;
    motivo: string;
    descripcion: string | null;
    emisor: { nombre: string; apellido: string; email: string };
    denunciado: { nombre: string; apellido: string; email: string };
  }): Promise<{ enviada: boolean; destinatarios: number; aviso?: string }> {
    let administradores: { email: string }[];
    try {
      administradores = await this.prisma.usuario.findMany({
        where: {
          rol: 'ADMINISTRADOR',
          estado: 'HABILITADO',
          deletedAt: null,
        },
        select: { email: true },
      });
    } catch (error: unknown) {
      const detalle = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `El reporte #${reporte.id_reporte} se guardó, pero no se pudieron consultar los destinatarios de soporte: ${detalle}`,
      );
      return {
        enviada: false,
        destinatarios: 0,
        aviso: 'El reporte se guardó, pero no se pudo notificar al soporte.',
      };
    }

    if (administradores.length === 0) {
      this.logger.error(
        `El reporte #${reporte.id_reporte} se guardó, pero no hay administradores activos para notificar.`,
      );
      return {
        enviada: false,
        destinatarios: 0,
        aviso: 'El reporte se guardó, pero no hay administradores activos para notificar.',
      };
    }

    const correo: Omit<EnvioCorreo, 'to'> = {
      subject: `Nuevo reporte #${reporte.id_reporte}`,
      html: `<p>Se recibió un nuevo reporte para revisión.</p>
        <ul>
          <li>Reporte: #${reporte.id_reporte}</li>
          <li>Pedido: ${escaparHtml(reporte.id_pedido)}</li>
          <li>Motivo: ${escaparHtml(reporte.motivo)}</li>
          <li>Descripción: ${escaparHtml(reporte.descripcion ?? 'Sin descripción')}</li>
          <li>Emisor: ${escaparHtml(`${reporte.emisor.nombre} ${reporte.emisor.apellido}`)} (${escaparHtml(reporte.emisor.email)})</li>
          <li>Denunciado: ${escaparHtml(`${reporte.denunciado.nombre} ${reporte.denunciado.apellido}`)} (${escaparHtml(reporte.denunciado.email)})</li>
        </ul>`,
      text: [
        `Se recibió un nuevo reporte para revisión (#${reporte.id_reporte}).`,
        `Pedido: ${reporte.id_pedido}`,
        `Motivo: ${reporte.motivo}`,
        `Descripción: ${reporte.descripcion ?? 'Sin descripción'}`,
        `Emisor: ${reporte.emisor.nombre} ${reporte.emisor.apellido} (${reporte.emisor.email})`,
        `Denunciado: ${reporte.denunciado.nombre} ${reporte.denunciado.apellido} (${reporte.denunciado.email})`,
      ].join('\n'),
    };

    const resultados = await Promise.all(
      administradores.map(async ({ email }) => {
        try {
          await this.mailerService.enviar({ ...correo, to: email });
          return true;
        } catch (error: unknown) {
          const detalle = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `El reporte #${reporte.id_reporte} se guardó, pero falló el correo a ${email}: ${detalle}`,
          );
          return false;
        }
      }),
    );
    const enviadas = resultados.filter(Boolean).length;
    const completa = enviadas === administradores.length;

    return {
      enviada: completa,
      destinatarios: administradores.length,
      ...(completa
        ? {}
        : {
            aviso:
              'El reporte se guardó, pero no se pudo notificar a todos los administradores.',
          }),
    };
  }

  async listarPedidosReportablesComerciante(idUsuario: string) {
    const comercio = await this.prisma.comercio.findUnique({
      where: { userId: idUsuario },
      select: { idComercio: true },
    });
    if (!comercio) {
      throw new NotFoundException('Comercio no encontrado para este usuario');
    }

    const pedidos = await this.prisma.pedido.findMany({
      where: {
        comercioId: comercio.idComercio,
        estado: { in: ESTADOS_REPORTABLES.COMERCIANTE },
      },
      select: {
        id_pedido: true,
        codigoAlfanumerico: true,
        estado: true,
        fecha_pedido: true,
        total: true,
        items: {
          select: {
            cantidad: true,
            producto: { select: { titulo: true } },
          },
        },
        reportes: {
          where: {
            id_emisor: idUsuario,
            estado_reporte: { in: [...ESTADOS_REPORTES_ABIERTOS] },
          },
          orderBy: { fecha_reporte: 'desc' },
          take: 1,
          select: {
            id_reporte: true,
            motivo: true,
            estado_reporte: true,
            fecha_reporte: true,
          },
        },
      },
      orderBy: { fecha_pedido: 'desc' },
    });

    return pedidos.map(({ reportes, ...pedido }) => ({
      ...pedido,
      reporteAbierto: reportes[0] ?? null,
    }));
  }

  private async verificarUmbralReportes(
    tx: Prisma.TransactionClient,
    idDenunciado: string,
  ) {
    const cantidadAbiertos = await tx.reporte.count({
      where: {
        id_denunciado: idDenunciado,
        estado_reporte: { in: [...ESTADOS_REPORTES_ABIERTOS] },
      },
    });

    if (cantidadAbiertos > 3) {
      await tx.usuario.updateMany({
        where: { id: idDenunciado, estado: 'HABILITADO' },
        data: { estado: 'BAJO_INVESTIGACION' },
      });
    }
  }

  async listarMisReportes(idUsuario: string, query: ListarMisReportesQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(Math.max(query.limit ?? 10, 1), 50);
    const skip = (page - 1) * limit;

    const whereClause: any = { id_emisor: idUsuario };
    if (query.estado) whereClause.estado_reporte = query.estado;

    const [total, reportes] = await Promise.all([
      this.prisma.reporte.count({ where: whereClause }),
      this.prisma.reporte.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: {
          pedido: {
            include: {
              comercio: { select: { idComercio: true, usuario: { select: { nombre: true, apellido: true } } } },
            },
          },
          denunciado: { select: { id: true, nombre: true, apellido: true } },
        },
        orderBy: { fecha_reporte: 'desc' },
      }),
    ]);

    return {
      data: reportes,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async obtenerDetalleReporte(idUsuario: string, idReporte: number, rolUsuario: Rol) {
    const reporte = await this.prisma.reporte.findUnique({
      where: { id_reporte: idReporte },
      include: {
        pedido: { select: { id_pedido: true, estado: true, comercioId: true, usuarioId: true } },
        emisor: { select: { id: true, nombre: true, apellido: true, email: true } },
        denunciado: { select: { id: true, nombre: true, apellido: true, email: true } },
        admin: { select: { id: true, nombre: true, apellido: true } },
      },
    });

    if (!reporte) throw new NotFoundException('Reporte no encontrado');

    // Solo el emisor, el denunciado o un admin pueden ver el detalle
    const esEmisor = reporte.id_emisor === idUsuario;
    const esDenunciado = reporte.id_denunciado === idUsuario;
    const esAdmin = rolUsuario === 'ADMINISTRADOR';

    if (!esEmisor && !esDenunciado && !esAdmin) {
      throw new ForbiddenException('No tienes permiso para ver este reporte');
    }

    return reporte;
  }
}