import type { BadgeTone } from '../../components/ui/Badge';

export interface EstadoMeta {
  label: string;
  tone: BadgeTone;
}

/**
 * Etiquetas visibles de los estados del pedido. La UI nunca muestra el enum
 * crudo (`PENDIENTE_DE_RETIRO`): siempre pasa por este mapa.
 */
export const ESTADO_PEDIDO_META: Record<string, EstadoMeta> = {
  PENDIENTE_PAGO: { label: 'Pendiente de pago', tone: 'pend' },
  PENDIENTE_DE_RETIRO: { label: 'Pendiente de retiro', tone: 'pend' },
  ENTREGADO: { label: 'Entregado', tone: 'ok' },
  CANCELADO: { label: 'Cancelado', tone: 'bad' },
  CANCELADO_POR_FALTA_RETIRO: {
    label: 'Cancelado por falta de retiro',
    tone: 'bad',
  },
};

export const ESTADO_PAGO_META: Record<string, EstadoMeta> = {
  PAGADO: { label: 'Pagado', tone: 'ok' },
  PENDIENTE: { label: 'Pendiente', tone: 'pend' },
  RECHAZADO: { label: 'Rechazado', tone: 'bad' },
  REEMBOLSADO: { label: 'Reembolsado', tone: 'neutro' },
};

export function metaEstadoPedido(estado: string | null | undefined): EstadoMeta {
  if (!estado) return { label: '—', tone: 'neutro' };

  return ESTADO_PEDIDO_META[estado] ?? { label: estado, tone: 'neutro' };
}

export function metaEstadoPago(estado: string | null | undefined): EstadoMeta {
  if (!estado) return { label: '—', tone: 'neutro' };

  return ESTADO_PAGO_META[estado] ?? { label: estado, tone: 'neutro' };
}
