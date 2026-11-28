import type {
  EstadoPedido,
  MotivoReporte,
  Rol,
} from '../../generated/prisma/enums.js';

export const MOTIVO_REPORTE_LABEL: Record<MotivoReporte, string> = {
  PRODUCTO_MAL_ESTADO: 'El producto estaba en mal estado/era diferente',
  COMERCIO_CERRADO: 'El comercio estaba cerrado al ir a retirar',
  PRECIO_NO_RESPETADO: 'El comercio no respetó el precio',
  CLIENTE_NO_RETIRO: 'El cliente no se presentó a retirar el producto',
  CANCELACION_INDEBIDA: 'Cancelación indebida en mostrador',
  COMPORTAMIENTO_INADECUADO: 'Comportamiento inadecuado del cliente',
  OTRO: 'Otro motivo',
};

const MOTIVOS_POR_ROL: Record<
  'CLIENTE' | 'COMERCIANTE',
  readonly MotivoReporte[]
> = {
  CLIENTE: [
    'PRODUCTO_MAL_ESTADO',
    'COMERCIO_CERRADO',
    'PRECIO_NO_RESPETADO',
    'OTRO',
  ],
  COMERCIANTE: [
    'CLIENTE_NO_RETIRO',
    'CANCELACION_INDEBIDA',
    'COMPORTAMIENTO_INADECUADO',
    'OTRO',
  ],
};

const ESTADOS_REPORTABLES = [
  'ENTREGADO',
  'PENDIENTE_DE_RETIRO',
  'CANCELADO',
  'CANCELADO_POR_FALTA_RETIRO',
] as const satisfies readonly EstadoPedido[];

type RolReportante = 'CLIENTE' | 'COMERCIANTE';

/**
 * Matriz motivo ↔ estado derivada del CU-5.02 y de la secuencia real del
 * retiro: el mal estado requiere entrega, el no-retiro requiere una reserva
 * vigente o cancelada por inasistencia, y "Otro" conserva todos los estados
 * reportables porque es la salida para incidencias no tipificadas.
 */
const ESTADOS_POR_MOTIVO: Record<
  MotivoReporte,
  Record<RolReportante, readonly EstadoPedido[]>
> = {
  PRODUCTO_MAL_ESTADO: {
    CLIENTE: ['ENTREGADO'],
    COMERCIANTE: [],
  },
  COMERCIO_CERRADO: {
    CLIENTE: [
      'PENDIENTE_DE_RETIRO',
      'CANCELADO',
      'CANCELADO_POR_FALTA_RETIRO',
    ],
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
    COMERCIANTE: [...ESTADOS_REPORTABLES],
  },
  OTRO: {
    CLIENTE: [...ESTADOS_REPORTABLES],
    COMERCIANTE: [...ESTADOS_REPORTABLES],
  },
};

export function esMotivoPermitido(
  rol: Rol,
  motivoCodigo: MotivoReporte,
): boolean {
  if (rol !== 'CLIENTE' && rol !== 'COMERCIANTE') return false;
  return MOTIVOS_POR_ROL[rol].includes(motivoCodigo);
}

export function esMotivoValidoParaEstado(
  rol: Rol,
  motivoCodigo: MotivoReporte,
  estado: EstadoPedido,
): boolean {
  if (rol !== 'CLIENTE' && rol !== 'COMERCIANTE') return false;
  return ESTADOS_POR_MOTIVO[motivoCodigo][rol].includes(estado);
}

export function inferirMotivoCodigo(
  motivo?: string | null,
): MotivoReporte | null {
  const valor = motivo?.trim();
  if (!valor) return null;

  for (const [codigo, etiqueta] of Object.entries(
    MOTIVO_REPORTE_LABEL,
  ) as [MotivoReporte, string][]) {
    if (etiqueta === valor) return codigo;
  }

  if (valor.toLowerCase() === 'otro' || valor.toLowerCase() === 'otro motivo') {
    return 'OTRO';
  }

  return null;
}

export function esFaltaDeRetiro(reporte: {
  motivoCodigo?: MotivoReporte | null;
  motivo?: string | null;
}): boolean {
  if (reporte.motivoCodigo) {
    return reporte.motivoCodigo === 'CLIENTE_NO_RETIRO';
  }

  return reporte.motivo === MOTIVO_REPORTE_LABEL.CLIENTE_NO_RETIRO;
}
