import type { MotivoReporte, Rol } from '../../generated/prisma/enums.js';

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

export function esMotivoPermitido(
  rol: Rol,
  motivoCodigo: MotivoReporte,
): boolean {
  if (rol !== 'CLIENTE' && rol !== 'COMERCIANTE') return false;
  return MOTIVOS_POR_ROL[rol].includes(motivoCodigo);
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
