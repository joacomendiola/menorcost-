import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  EstadoPedidoVisible,
  PedidoResumen,
  PedidoTicket,
} from './pedidos.types.js';

/**
 * Consultas de lectura del historial de pedidos del cliente (CU-3.03).
 *
 * Solo se exponen pedidos del propio usuario. Los `PENDIENTE_PAGO` (pagos
 * rechazados) quedan fuera del historial: no descontaron stock ni generaron
 * ticket.
 */
@Injectable()
export class PedidosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(usuarioId: string): Promise<PedidoResumen[]> {
    const pedidos = await this.prisma.pedido.findMany({
      where: {
        usuarioId,
        estado: { not: 'PENDIENTE_PAGO' },
      },
      orderBy: { fecha_pedido: 'desc' },
      select: {
        id_pedido: true,
        codigoAlfanumerico: true,
        estado: true,
        fecha_pedido: true,
        total: true,
        comercio: {
          select: { idComercio: true, nombreFantasia: true },
        },
        franjaHoraria: {
          select: { horaInicio: true, horaFin: true },
        },
        items: { select: { cantidad: true } },
      },
    });

    return pedidos.map((pedido) => ({
      idPedido: pedido.id_pedido,
      codigoAlfanumerico: pedido.codigoAlfanumerico,
      estado: pedido.estado as EstadoPedidoVisible,
      fechaPedido: pedido.fecha_pedido.toISOString(),
      total: pedido.total.toNumber(),
      comercio: pedido.comercio
        ? {
            idComercio: pedido.comercio.idComercio,
            nombre: pedido.comercio.nombreFantasia,
          }
        : null,
      franjaHorario: pedido.franjaHoraria
        ? {
            inicio: pedido.franjaHoraria.horaInicio,
            fin: pedido.franjaHoraria.horaFin,
          }
        : null,
      itemsCantidad: pedido.items.reduce(
        (total, item) => total + item.cantidad,
        0,
      ),
    }));
  }

  async obtenerPorCodigo(
    usuarioId: string,
    codigo: string,
  ): Promise<PedidoTicket> {
    const limpio = codigo.trim();
    const posibles = Array.from(
      new Set([limpio, limpio.toUpperCase()]),
    ).filter(Boolean);

    const pedido = await this.prisma.pedido.findFirst({
      where: {
        usuarioId,
        OR: [
          { codigoAlfanumerico: { in: posibles } },
          { codigoQR: { in: posibles } },
        ],
      },
      select: {
        id_pedido: true,
        codigoAlfanumerico: true,
        codigoQR: true,
        estado: true,
        fecha_pedido: true,
        subtotal: true,
        tarifa_servicio: true,
        total: true,
        comercio: {
          select: {
            idComercio: true,
            nombreFantasia: true,
            abierto: true,
          },
        },
        franjaHoraria: {
          select: { horaInicio: true, horaFin: true },
        },
        items: {
          orderBy: { nroLinea: 'asc' },
          select: {
            id_pedido_item: true,
            nombreHistorico: true,
            cantidad: true,
            precio_unitario: true,
            subtotal: true,
            producto: { select: { imagen: true } },
          },
        },
        calificacion: {
          select: {
            id_calificacion: true,
            puntaje: true,
            comentario: true,
            fecha_creacion: true,
          },
        },
        reportes: {
          where: { id_emisor: usuarioId },
          orderBy: { fecha_reporte: 'desc' },
          select: {
            id_reporte: true,
            motivo: true,
            estado_reporte: true,
            fecha_reporte: true,
          },
        },
      },
    });

    if (!pedido) {
      throw new NotFoundException('No encontramos ese pedido.');
    }

    return {
      idPedido: pedido.id_pedido,
      codigoAlfanumerico: pedido.codigoAlfanumerico,
      codigoQR: pedido.codigoQR,
      estado: pedido.estado as EstadoPedidoVisible,
      fechaPedido: pedido.fecha_pedido.toISOString(),
      subtotal: pedido.subtotal.toNumber(),
      tarifaServicio: pedido.tarifa_servicio.toNumber(),
      total: pedido.total.toNumber(),
      comercio: pedido.comercio
        ? {
            idComercio: pedido.comercio.idComercio,
            nombre: pedido.comercio.nombreFantasia,
          }
        : null,
      franjaHorario: pedido.franjaHoraria
        ? {
            inicio: pedido.franjaHoraria.horaInicio,
            fin: pedido.franjaHoraria.horaFin,
          }
        : null,
      localAbierto: pedido.comercio?.abierto ?? null,
      items: pedido.items.map((item) => ({
        id: item.id_pedido_item,
        titulo: item.nombreHistorico,
        imagen: item.producto?.imagen ?? null,
        cantidad: item.cantidad,
        precioUnitario: item.precio_unitario.toNumber(),
        subtotal: item.subtotal.toNumber(),
      })),
      calificacion: pedido.calificacion
        ? {
            id: pedido.calificacion.id_calificacion,
            puntaje: pedido.calificacion.puntaje,
            comentario: pedido.calificacion.comentario,
            fecha: pedido.calificacion.fecha_creacion.toISOString(),
          }
        : null,
      misReportes: pedido.reportes.map((reporte) => ({
        id: reporte.id_reporte,
        motivo: reporte.motivo,
        estado: reporte.estado_reporte,
        fecha: reporte.fecha_reporte.toISOString(),
      })),
    };
  }
}

