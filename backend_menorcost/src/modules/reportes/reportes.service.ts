import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CrearReporteDto } from './dto/crear-reporte.dto.js';
import type { ListarMisReportesQueryDto } from './dto/listar-mis-reportes-query.dto.js';
import type { EstadoReporte, TipoDestinoReporte, Rol } from '../../generated/prisma/enums.js';

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  async crearReporte(idUsuario: string, rolUsuario: Rol, dto: CrearReporteDto) {
    // 1. Verificar que el pedido existe (UNA SOLA QUERY con include anidado)
    const pedido = await this.prisma.pedido.findUnique({
      where: { id_pedido: dto.idPedido },
      include: {
        usuario: { select: { id: true } },
        comercio: { include: { usuario: { select: { id: true } } } },
      },
    });

    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado');
    }

    if (!pedido.comercio) {
      throw new NotFoundException('Comercio asociado al pedido no encontrado');
    }

    // 2. Validar permisos según rol y determinar denunciado
    let idDenunciado: string;
    let tipoDestinoEsperado: TipoDestinoReporte;

    if (rolUsuario === 'CLIENTE') {
      if (pedido.usuarioId !== idUsuario) {
        throw new ForbiddenException('No puedes reportar un pedido que no te pertenece');
      }
      idDenunciado = pedido.comercio.usuario.id;
      tipoDestinoEsperado = 'COMERCIO';
    } else if (rolUsuario === 'COMERCIANTE') {
      if (pedido.comercio.usuario.id !== idUsuario) {
        throw new ForbiddenException('No puedes reportar un pedido de otro comercio');
      }
      idDenunciado = pedido.usuarioId;
      tipoDestinoEsperado = 'CLIENTE';
    } else {
      throw new ForbiddenException('Solo clientes y comerciantes pueden crear reportes');
    }

    // 3. Validar que el tipo_destino coincide con el rol
    if (dto.tipo_destino !== tipoDestinoEsperado) {
      throw new BadRequestException('El tipo de destino no corresponde a tu rol');
    }

    // 4. Validar que no exista reporte previo del mismo usuario para este pedido
    const reporteExistente = await this.prisma.reporte.findFirst({
      where: {
        id_pedido: dto.idPedido,
        id_emisor: idUsuario,
      },
    });

    if (reporteExistente) {
      throw new ConflictException('Ya existe un reporte en revisión emitido por ti para este pedido');
    }

    // 5. Validar descripción obligatoria si motivo es "Otro motivo"
    const esOtroMotivo = dto.motivo.toLowerCase().includes('otro');
    if (esOtroMotivo && (!dto.descripcion || dto.descripcion.trim() === '')) {
      throw new BadRequestException('Por favor, especifica brevemente el problema ocurrido');
    }

    // 6. Crear el reporte en transacción
    return this.prisma.$transaction(async (tx) => {
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

      // 7. Verificar umbral de 3 reportes para poner BAJO_INVESTIGACION
      await this.verificarUmbralReportes(tx, idDenunciado);

      return reporte;
    });
  }

  private async verificarUmbralReportes(tx: any, idDenunciado: string) {
    const reportesAbiertos = await tx.reporte.count({
      where: {
        id_denunciado: idDenunciado,
        estado_reporte: { in: ['PENDIENTE_REVISION', 'BAJO_INVESTIGACION'] },
      },
    });

    if (reportesAbiertos >= 3) {
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