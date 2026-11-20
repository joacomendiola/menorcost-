import { Prisma } from '../../generated/prisma/client.js';

/**
 * Redondea hacia arriba a 2 decimales, igual que el simulador de precios:
 * el remanente fraccionario nunca deja al comerciante por debajo de su neto.
 */
export function redondearArriba2(valor: Prisma.Decimal): Prisma.Decimal {
  return valor.toDecimalPlaces(2, Prisma.Decimal.ROUND_CEIL);
}

export function aDecimal(valor: Prisma.Decimal | string | number): Prisma.Decimal {
  return valor instanceof Prisma.Decimal ? valor : new Prisma.Decimal(valor);
}

/**
 * Los montos viajan como string con 2 decimales en DTOs y respuestas.
 * Nunca se expone un `number` (evita pérdida de precisión en el transporte).
 */
export function aMonto(valor: Prisma.Decimal): string {
  return valor.toFixed(2);
}
