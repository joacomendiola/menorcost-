import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CrearCalificacionDto } from './dto/crear-calificacion.dto.js';
import type { ListarResenasQueryDto } from './dto/listar-resenas-query.dto.js';

@Injectable()
export class ReputacionService {
  constructor(private readonly prisma: PrismaService) {}

  async crearCalificacion(idUsuario: string, dto: CrearCalificacionDto) {
    const maxIntentos = 3;

    for (let intento = 1; intento <= maxIntentos; intento++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const pedido = await tx.pedido.findUnique({
              where: { id_pedido: dto.idPedido },
              include: { calificacion: true },
            });

            if (!pedido) {
              throw new NotFoundException('Pedido no encontrado');
            }

            if (pedido.usuarioId !== idUsuario) {
              throw new ForbiddenException('No puedes calificar un pedido que no te pertenece');
            }

            if (pedido.estado !== 'ENTREGADO') {
              throw new BadRequestException('Solo se pueden calificar pedidos en estado ENTREGADO');
            }

            if (pedido.calificacion) {
              throw new ConflictException('Este pedido ya fue calificado previamente');
            }

            const calificacion = await tx.calificacion.create({
              data: {
                id_pedido: dto.idPedido,
                puntaje: dto.puntaje,
                comentario: dto.comentario,
              },
            });

            const reputacionComercio = await this.recalcularReputacionTx(tx, pedido.comercioId);

            return {
              calificacion,
              reputacionComercio,
            };
          },
          { isolationLevel: 'Serializable' },
        );
      } catch (error: unknown) {
        const codigo =
          error && typeof error === 'object' && 'code' in error
            ? (error as { code?: string }).code
            : undefined;

        // Restricción única de id_pedido ante solicitudes concurrentes
        if (codigo === 'P2002') {
          throw new ConflictException('Este pedido ya fue calificado previamente');
        }

        // Conflicto de serialización (P2034): reintentamos si quedan intentos disponibles
        if (codigo === 'P2034' && intento < maxIntentos) {
          continue;
        }

        throw error;
      }
    }
  }

  async obtenerReputacionComercioPorUsuario(
    idUsuario: string,
    query?: ListarResenasQueryDto,
  ) {
    const comercio = await this.prisma.comercio.findUnique({
      where: { usuarioId: idUsuario },
    });

    if (!comercio) {
      throw new NotFoundException('Comercio no encontrado para este usuario');
    }

    return this.obtenerReputacionComercio(comercio.idComercio, query);
  }

  async obtenerReputacionComercio(
    id_comercio: string,
    query?: ListarResenasQueryDto,
  ) {
    const limit = Math.min(Math.max(query?.limit ?? 10, 1), 50);
    const cursor = query?.cursor;
    const filtroComercio = { comercioId: id_comercio, estado: 'ENTREGADO' };

    const [gruposPuntaje, calificacionesPagina] = await Promise.all([
      this.prisma.calificacion.groupBy({
        by: ['puntaje'],
        where: { pedido: filtroComercio },
        _count: { id_calificacion: true },
      }),
      this.prisma.calificacion.findMany({
        where: { pedido: filtroComercio },
        take: limit + 1,
        ...(cursor
          ? {
              cursor: { id_calificacion: cursor },
              skip: 1,
            }
          : {}),
        include: {
          pedido: {
            include: {
              usuario: {
                select: {
                  nombre: true,
                  apellido: true,
                },
              },
            },
          },
        },
        orderBy: [
          { fecha_creacion: 'desc' },
          { id_calificacion: 'desc' },
        ],
      }),
    ]);

    const distribucion: Record<string, number> = {
      '5': 0,
      '4': 0,
      '3': 0,
      '2': 0,
      '1': 0,
    };
    let totalResenas = 0;
    let sumaPuntajes = 0;

    for (const grupo of gruposPuntaje) {
      const cantidad = grupo._count.id_calificacion;
      distribucion[grupo.puntaje.toString()] = cantidad;
      totalResenas += cantidad;
      sumaPuntajes += grupo.puntaje * cantidad;
    }

    const promedio =
      totalResenas > 0 ? Math.round((sumaPuntajes / totalResenas) * 10) / 10 : 0;

    const hasMore = calificacionesPagina.length > limit;
    const itemsPagina = hasMore
      ? calificacionesPagina.slice(0, limit)
      : calificacionesPagina;

    const resenas = itemsPagina.map((cal) => {
      const cliente = cal.pedido?.usuario ?? {
        nombre: 'Cliente',
        apellido: 'Anónimo',
      };

      return {
        id: cal.id_calificacion,
        clienteNombre: `${cliente.nombre} ${cliente.apellido}`,
        fecha: cal.fecha_creacion.toISOString(),
        puntaje: cal.puntaje,
        comentario: cal.comentario || '',
      };
    });

    const nextCursor =
      hasMore && itemsPagina.length > 0
        ? itemsPagina[itemsPagina.length - 1].id_calificacion
        : null;

    return {
      promedio,
      totalResenas,
      distribucion,
      resenas,
      paginacion: {
        limit,
        nextCursor,
        hasMore,
      },
    };
  }

  async recalcularReputacionComercio(id_comercio: string) {
    return this.prisma.$transaction(
      async (tx) => this.recalcularReputacionTx(tx, id_comercio),
      { isolationLevel: 'Serializable' },
    );
  }

  private async recalcularReputacionTx(tx: any, id_comercio: string) {
    const agregacion = await tx.calificacion.aggregate({
      _avg: { puntaje: true },
      _count: { id_calificacion: true },
      where: {
        pedido: { comercioId: id_comercio, estado: 'ENTREGADO' },
      },
    });

    const promedioOriginal = agregacion._avg.puntaje || 0;
    const promedioRedondeado = Math.round(promedioOriginal * 10) / 10;
    const totalCalificaciones = agregacion._count.id_calificacion || 0;

    await tx.comercio.update({
      where: { idComercio: id_comercio },
      data: {
        reputacionPromedio: promedioRedondeado,
        totalCalificaciones: totalCalificaciones,
      },
    });

    return { promedio: promedioRedondeado, total: totalCalificaciones };
  }
}