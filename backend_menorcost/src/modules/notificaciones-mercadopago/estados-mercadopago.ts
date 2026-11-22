import type { RespuestaOrdenMp } from '../pagos-mercadopago/cliente-mercadopago.js';

export type ResultadoOrdenMp = 'pagado' | 'rechazado' | 'pendiente';

type PagoDeOrden = NonNullable<
  NonNullable<RespuestaOrdenMp['transactions']>['payments']
>[number];

/** Último intento de pago de la order: es el que define el estado actual. */
export function ultimoPagoDeOrden(
  orden: RespuestaOrdenMp,
): PagoDeOrden | undefined {
  const pagos = orden.transactions?.payments ?? [];

  return pagos[pagos.length - 1];
}

/**
 * Traduce el estado de la order de Mercado Pago al efecto sobre nuestro pedido.
 *
 * - `pagado`: order `processed` o pago `approved` (status_detail `accredited`).
 * - `rechazado`: pago `rejected` u order `cancelled`/`expired`. El pedido sigue
 *   `PENDIENTE_PAGO` y el intento queda cerrado para permitir el reintento.
 * - `pendiente`: todo lo demás (`created`, `action_required`, pendientes de
 *   acreditación). No se toca el estado del pedido.
 */
export function resultadoDeOrden(orden: RespuestaOrdenMp): ResultadoOrdenMp {
  const pago = ultimoPagoDeOrden(orden);

  if (pago?.status === 'approved' || orden.status === 'processed') {
    return 'pagado';
  }

  if (
    pago?.status === 'rejected' ||
    orden.status === 'cancelled' ||
    orden.status === 'expired'
  ) {
    return 'rechazado';
  }

  return 'pendiente';
}
