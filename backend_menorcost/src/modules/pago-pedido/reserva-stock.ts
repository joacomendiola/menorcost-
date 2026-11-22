import { ConflictException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';

/**
 * Reserva y liberación del stock de un pedido.
 *
 * La reserva es un decremento condicional: si dos compras simultáneas pelean
 * por la última unidad, solo una obtiene `count === 1` y la otra revierte la
 * transacción completa.
 *
 * La liberación es idempotente por dos motivos:
 * - `estado: 'PENDIENTE_PAGO'`: solo se libera una reserva viva.
 * - `stockLiberadoEn: null`: el primer liberador gana; el segundo obtiene 0.
 *
 * Nunca se llama fuera de una transacción: el pedido y el stock tienen que
 * cambiar juntos.
 */

export const MENSAJE_STOCK =
  'Uno o más productos seleccionados se han agotado o no cuentan con el stock suficiente.';

export type MotivoCancelacion =
  | 'EXPIRADO'
  | 'PAGO_NO_INICIADO'
  | 'PAGO_RECHAZADO'
  | 'CANCELADO_POR_COMERCIO';

export interface ItemReservado {
  productoId: string;
  cantidad: number;
}

/** Descuenta stock de forma condicional; lanza `Conflict` si no alcanza. */
export async function reservarStock(
  tx: Prisma.TransactionClient,
  items: readonly ItemReservado[],
): Promise<void> {
  for (const item of items) {
    const { count } = await tx.producto.updateMany({
      where: {
        idProducto: item.productoId,
        estado: 'ACTIVO',
        stock: { gte: item.cantidad },
      },
      data: { stock: { decrement: item.cantidad } },
    });

    if (count !== 1) {
      throw new ConflictException(MENSAJE_STOCK);
    }
  }
}

/**
 * Cancela un pedido pendiente de pago y devuelve su stock.
 *
 * Devuelve `false` cuando otro proceso ya lo canceló o el pedido dejó de estar
 * pendiente: en ese caso no se toca el stock y el llamador no debe notificar.
 */
export async function liberarStockDePedido(
  tx: Prisma.TransactionClient,
  idPedido: string,
  motivo: MotivoCancelacion,
): Promise<boolean> {
  const items = await tx.pedidoItem.findMany({
    where: { pedidoId: idPedido },
    select: { productoId: true, cantidad: true },
  });

  const { count } = await tx.pedido.updateMany({
    where: {
      id_pedido: idPedido,
      estado: 'PENDIENTE_PAGO',
      stockLiberadoEn: null,
    },
    data: {
      estado: 'CANCELADO',
      motivoCancelacion: motivo,
      stockLiberadoEn: new Date(),
    },
  });

  if (count !== 1) {
    return false;
  }

  for (const item of items) {
    await tx.producto.updateMany({
      where: { idProducto: item.productoId },
      data: { stock: { increment: item.cantidad } },
    });
  }

  return true;
}
