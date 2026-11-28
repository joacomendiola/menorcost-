import type { EstadoPedido, MotivoReporte } from '../../api';

export interface MotivoReporteOption {
  value: MotivoReporte;
  label: string;
}

export const MOTIVOS_CLIENTE: MotivoReporteOption[] = [
  {
    value: 'PRODUCTO_MAL_ESTADO',
    label: 'El producto estaba en mal estado/era diferente',
  },
  {
    value: 'COMERCIO_CERRADO',
    label: 'El comercio estaba cerrado al ir a retirar',
  },
  {
    value: 'PRECIO_NO_RESPETADO',
    label: 'El comercio no respetó el precio',
  },
  { value: 'OTRO', label: 'Otro motivo' },
];

export const MOTIVOS_COMERCIANTE: MotivoReporteOption[] = [
  {
    value: 'CLIENTE_NO_RETIRO',
    label: 'El cliente no se presentó a retirar el producto',
  },
  {
    value: 'CANCELACION_INDEBIDA',
    label: 'Cancelación indebida en mostrador',
  },
  {
    value: 'COMPORTAMIENTO_INADECUADO',
    label: 'Comportamiento inadecuado del cliente',
  },
  { value: 'OTRO', label: 'Otro motivo' },
];

export const ESTADOS_REPORTABLES_CLIENTE: ReadonlyArray<EstadoPedido> = [
  'ENTREGADO',
  'PENDIENTE_DE_RETIRO',
  'CANCELADO',
  'CANCELADO_POR_FALTA_RETIRO',
];

export const ESTADOS_REPORTABLES_COMERCIANTE: ReadonlyArray<EstadoPedido> = [
  ...ESTADOS_REPORTABLES_CLIENTE,
];

const TODOS_LOS_ESTADOS: ReadonlyArray<EstadoPedido> = [
  ...ESTADOS_REPORTABLES_CLIENTE,
];

type RolReportante = 'CLIENTE' | 'COMERCIANTE';

/**
 * Espejo frontend de la matriz del backend. El mal estado exige entrega, el
 * no-retiro exige una reserva vigente o cancelada por inasistencia y "Otro"
 * cubre los estados reportables para incidencias no tipificadas.
 */
const ESTADOS_POR_MOTIVO: Record<
  MotivoReporte,
  Record<RolReportante, ReadonlyArray<EstadoPedido>>
> = {
  PRODUCTO_MAL_ESTADO: { CLIENTE: ['ENTREGADO'], COMERCIANTE: [] },
  COMERCIO_CERRADO: {
    CLIENTE: ['PENDIENTE_DE_RETIRO', 'CANCELADO', 'CANCELADO_POR_FALTA_RETIRO'],
    COMERCIANTE: [],
  },
  PRECIO_NO_RESPETADO: {
    CLIENTE: ['ENTREGADO', 'PENDIENTE_DE_RETIRO', 'CANCELADO'],
    COMERCIANTE: [],
  },
  CLIENTE_NO_RETIRO: {
    CLIENTE: [],
    COMERCIANTE: ['PENDIENTE_DE_RETIRO', 'CANCELADO_POR_FALTA_RETIRO'],
  },
  CANCELACION_INDEBIDA: {
    CLIENTE: [],
    COMERCIANTE: ['PENDIENTE_DE_RETIRO', 'CANCELADO'],
  },
  COMPORTAMIENTO_INADECUADO: {
    CLIENTE: [],
    COMERCIANTE: [...TODOS_LOS_ESTADOS],
  },
  OTRO: {
    CLIENTE: [...TODOS_LOS_ESTADOS],
    COMERCIANTE: [...TODOS_LOS_ESTADOS],
  },
};

export function motivosParaEstado(
  rol: RolReportante,
  estado: EstadoPedido,
): MotivoReporteOption[] {
  const motivos = rol === 'CLIENTE' ? MOTIVOS_CLIENTE : MOTIVOS_COMERCIANTE;
  return motivos.filter((motivo) =>
    ESTADOS_POR_MOTIVO[motivo.value][rol].includes(estado),
  );
}
