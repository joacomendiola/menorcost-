import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { notificarPedido } from './pedido-notificaciones.js';
import type {
  EntregaValidada,
  EstadoPedidoVisible,
  PedidoComercio,
  PedidoResumen,
  PedidoTicket,
} from './pedidos.types.js';

/** Estados en los que el comerciante puede obrar sobre el pedido. */
const ESTADOS_CON_ACCION_COMERCIO = [
  'PENDIENTE_PAGO',
  'PENDIENTE_DE_RETIRO',
] as const;

/**
 * Consultas y transiciones de pedidos.
 *
 * - Cliente (CU-3.03): historial y ticket.
 * - Comerciante (CU-2.06): validación del código en mostrador, confirmación de
 *   entrega y cancelación de pedidos que quedaron sin pagar.
 */
@Injectable()
export class PedidosService {
  private readonly logger = new Logger(PedidosService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listar(usuarioId: string): Promise<PedidoResumen[]> {
    const pedidos = await this.prisma.pedido.findMany({
      // Incluye `PENDIENTE_PAGO`: desde "Mis pedidos" se reintenta el pago.
      where: { usuarioId },
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
        items: {
          orderBy: { nroLinea: 'asc' },
          select: { cantidad: true, nombreHistorico: true },
        },
      },
    });

    return pedidos.map((pedido) => ({
      idPedido: pedido.id_pedido,
      codigoAlfanumerico: pedido.codigoAlfanumerico,
      estado: pedido.estado,
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
      items: pedido.items.map((item) => ({
        titulo: item.nombreHistorico,
        cantidad: item.cantidad,
      })),
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
        // Los pagos rechazados ya no generan pedido, pero los `PENDIENTE_PAGO`
        // históricos no deben exponerse como ticket válido.
        estado: { not: 'PENDIENTE_PAGO' },
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
        fecha_entrega: true,
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
        pagos: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { estado: true },
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
      fechaEntrega: pedido.fecha_entrega?.toISOString() ?? null,
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
      pagoEstado: pedido.pagos[0]?.estado ?? null,
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

  /** Pedidos del comercio autenticado para el panel de mostrador. */
  async listarComercio(usuarioId: string): Promise<PedidoComercio[]> {
    const comercio = await this.obtenerComercio(usuarioId);

    const pedidos = await this.prisma.pedido.findMany({
      where: {
        comercioId: comercio.idComercio,
        estado: { in: [...ESTADOS_CON_ACCION_COMERCIO, 'ENTREGADO'] },
      },
      orderBy: { fecha_pedido: 'desc' },
      take: 100,
      select: SELECT_PEDIDO_COMERCIO,
    });

    return pedidos.map(aPedidoComercio);
  }

  /**
   * Valida un código en mostrador sin cambiar nada. Devuelve si el pedido
   * puede entregarse y por qué no, para que la UI lo muestre antes de
   * confirmar.
   */
  async validarEntrega(
    usuarioId: string,
    codigo: string,
  ): Promise<EntregaValidada> {
    const pedido = await this.buscarPorCodigoDelComercio(usuarioId, codigo);

    if (!pedido) {
      throw new NotFoundException(
        'No encontramos un pedido con ese código en tu comercio.',
      );
    }

    const pagoEstado = pedido.pagos[0]?.estado ?? null;
    const puedeEntregar =
      pedido.estado === 'PENDIENTE_DE_RETIRO' && pagoEstado === 'PAGADO';

    return {
      pedido: aPedidoComercio(pedido),
      puedeEntregar,
      motivo: motivoNoEntregable(pedido.estado, pagoEstado),
    };
  }

  /**
   * CU-2.06: confirma la entrega física. Idempotente: si el pedido ya está
   * ENTREGADO devuelve el mismo resultado en lugar de fallar.
   */
  async confirmarEntrega(usuarioId: string, idPedido: string) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id_pedido: idPedido },
      select: {
        id_pedido: true,
        usuarioId: true,
        estado: true,
        codigoAlfanumerico: true,
        comercio: { select: { userId: true } },
        pagos: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { estado: true },
        },
      },
    });

    if (!pedido || pedido.comercio?.userId !== usuarioId) {
      throw new NotFoundException('Pedido no encontrado.');
    }

    if (pedido.estado === 'ENTREGADO') {
      return {
        idPedido: pedido.id_pedido,
        estado: 'ENTREGADO' as const,
        yaEntregado: true,
      };
    }

    if (pedido.estado !== 'PENDIENTE_DE_RETIRO') {
      throw new ConflictException(
        `No se puede entregar un pedido en estado ${pedido.estado}.`,
      );
    }

    if (pedido.pagos[0]?.estado !== 'PAGADO') {
      throw new ConflictException(
        'El pago del pedido no figura como aprobado.',
      );
    }

    const actualizados = await this.prisma.pedido.updateMany({
      where: { id_pedido: idPedido, estado: 'PENDIENTE_DE_RETIRO' },
      data: { estado: 'ENTREGADO', fecha_entrega: new Date() },
    });

    if (actualizados.count === 0) {
      // Otro request ganó la carrera: se trata como entrega idempotente.
      const actual = await this.prisma.pedido.findUnique({
        where: { id_pedido: idPedido },
        select: { estado: true },
      });

      if (actual?.estado === 'ENTREGADO') {
        return {
          idPedido,
          estado: 'ENTREGADO' as const,
          yaEntregado: true,
        };
      }

      throw new ConflictException(
        'El pedido cambió de estado mientras se confirmaba la entrega.',
      );
    }

    await notificarPedido(this.prisma, {
      usuarioId: pedido.usuarioId,
      tipo: 'PEDIDO_ENTREGADO',
      titulo: 'Pedido entregado',
      mensaje: `El pedido ${pedido.codigoAlfanumerico} fue entregado. Ya podés calificarlo y reportar problemas.`,
    });

    return {
      idPedido,
      estado: 'ENTREGADO' as const,
      yaEntregado: false,
    };
  }

  /**
   * Única cancelación permitida: un pedido que quedó `PENDIENTE_PAGO`.
   * Libera el stock reservado. No hay reembolsos: nunca se cobró.
   */
  async cancelarPendientePago(usuarioId: string, idPedido: string) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id_pedido: idPedido },
      select: {
        id_pedido: true,
        usuarioId: true,
        estado: true,
        codigoAlfanumerico: true,
        comercio: { select: { userId: true } },
        items: { select: { productoId: true, cantidad: true } },
      },
    });

    if (!pedido || pedido.comercio?.userId !== usuarioId) {
      throw new NotFoundException('Pedido no encontrado.');
    }

    if (pedido.estado !== 'PENDIENTE_PAGO') {
      throw new ConflictException(
        'Solo se puede cancelar un pedido pendiente de pago.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const actualizados = await tx.pedido.updateMany({
        where: { id_pedido: idPedido, estado: 'PENDIENTE_PAGO' },
        data: { estado: 'CANCELADO' },
      });

      if (actualizados.count === 0) {
        throw new ConflictException(
          'El pedido cambió de estado mientras se cancelaba.',
        );
      }

      for (const item of pedido.items) {
        await tx.producto.updateMany({
          where: { idProducto: item.productoId },
          data: { stock: { increment: item.cantidad } },
        });
      }
    });

    await notificarPedido(this.prisma, {
      usuarioId: pedido.usuarioId,
      tipo: 'PEDIDO_CANCELADO',
      titulo: 'Pedido cancelado',
      mensaje: `El comercio canceló el pedido ${pedido.codigoAlfanumerico} porque quedó pendiente de pago. No se te cobró nada.`,
    });

    return {
      idPedido,
      estado: 'CANCELADO' as const,
      stockRestaurado: true,
    };
  }

  private async obtenerComercio(usuarioId: string) {
    const comercio = await this.prisma.comercio.findUnique({
      where: { userId: usuarioId },
      select: { idComercio: true },
    });

    if (!comercio) {
      throw new NotFoundException('No tenés un comercio asociado.');
    }

    return comercio;
  }

  private async buscarPorCodigoDelComercio(usuarioId: string, codigo: string) {
    const limpio = codigo.trim();
    const posibles = Array.from(
      new Set([limpio, limpio.toUpperCase()]),
    ).filter(Boolean);

    if (posibles.length === 0) return null;

    return this.prisma.pedido.findFirst({
      where: {
        comercio: { userId: usuarioId },
        OR: [
          { codigoAlfanumerico: { in: posibles } },
          { codigoQR: { in: posibles } },
        ],
      },
      select: SELECT_PEDIDO_COMERCIO,
    });
  }
}

const SELECT_PEDIDO_COMERCIO = {
  id_pedido: true,
  codigoAlfanumerico: true,
  estado: true,
  fecha_pedido: true,
  fecha_entrega: true,
  total: true,
  usuario: { select: { nombre: true, apellido: true } },
  pagos: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: { estado: true },
  },
  items: {
    orderBy: { nroLinea: 'asc' as const },
    select: { cantidad: true, nombreHistorico: true },
  },
} as const;

interface PedidoComercioRow {
  id_pedido: string;
  codigoAlfanumerico: string;
  estado: string;
  fecha_pedido: Date;
  fecha_entrega: Date | null;
  total: { toNumber(): number };
  usuario: { nombre: string; apellido: string } | null;
  pagos: Array<{ estado: string }>;
  items: Array<{ cantidad: number; nombreHistorico: string }>;
}

function aPedidoComercio(pedido: PedidoComercioRow): PedidoComercio {
  return {
    idPedido: pedido.id_pedido,
    codigoAlfanumerico: pedido.codigoAlfanumerico,
    estado: pedido.estado as PedidoComercio['estado'],
    fechaPedido: pedido.fecha_pedido.toISOString(),
    fechaEntrega: pedido.fecha_entrega?.toISOString() ?? null,
    total: pedido.total.toNumber(),
    cliente: pedido.usuario
      ? { nombre: pedido.usuario.nombre, apellido: pedido.usuario.apellido }
      : null,
    pagoEstado: pedido.pagos[0]?.estado ?? null,
    items: pedido.items.map((item) => ({
      titulo: item.nombreHistorico,
      cantidad: item.cantidad,
    })),
  };
}

function motivoNoEntregable(
  estado: string,
  pagoEstado: string | null,
): string | null {
  if (estado === 'ENTREGADO') return 'Este pedido ya fue entregado.';
  if (estado === 'PENDIENTE_PAGO') return 'El pedido todavía no está pagado.';
  if (estado !== 'PENDIENTE_DE_RETIRO') {
    return `El pedido está en estado ${estado}.`;
  }
  if (pagoEstado !== 'PAGADO') {
    return 'El pago del pedido no figura como aprobado.';
  }

  return null;
}
