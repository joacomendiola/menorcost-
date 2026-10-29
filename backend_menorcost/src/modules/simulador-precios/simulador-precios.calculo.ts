import { Prisma } from '../../generated/prisma/client.js';
import { ADVERTENCIA_NETO_ESTIMADO } from './simulador-precios.constants.js';
import type {
  SimulacionPrecioInput,
  SimulacionPrecioResultado,
} from './simulador-precios.types.js';

export class PrecioInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrecioInvalidoError';
  }
}

/**
 * Redondea hacia arriba a 2 decimales. El remanente fraccionario queda a favor
 * del comerciante, porque nunca se reduce el neto por debajo de su base.
 */
function redondearArriba2(valor: Prisma.Decimal): Prisma.Decimal {
  return valor.toDecimalPlaces(2, Prisma.Decimal.ROUND_CEIL);
}

function parseDecimal(valor: string, campo: string): Prisma.Decimal {
  try {
    const decimal = new Prisma.Decimal(valor);
    if (!decimal.isFinite()) {
      throw new Error('valor no finito');
    }
    return decimal;
  } catch {
    throw new PrecioInvalidoError(
      `El campo ${campo} debe ser un número válido`,
    );
  }
}

/**
 * Calcula el precio público de un producto a partir del precio base neto que
 * desea recibir el comerciante.
 *
 * Fórmulas:
 *   C  = ceil2(B * c)                 comisión de Menorcost
 *   P  = ceil2((B + C) / (1 - F))     precio público
 *   Fm = ceil2(P * F)                 comisión estimada de Mercado Pago
 *   M  = P - C - Fm                   neto estimado del comerciante
 *
 * donde B es el precio base neto, c la tasa de Menorcost y F la tasa estimada
 * de Mercado Pago. Las tasas son provistas por el Service, nunca por el
 * frontend.
 */
export function calcularPrecios(
  input: SimulacionPrecioInput,
): SimulacionPrecioResultado {
  const precioBaseNeto = parseDecimal(input.precioBaseNeto, 'precioBaseNeto');
  const comisionMenorcostTasa = parseDecimal(
    input.comisionMenorcostTasa,
    'comisionMenorcostTasa',
  );
  const tasaMpEstimada = parseDecimal(input.tasaMpEstimada, 'tasaMpEstimada');

  if (!precioBaseNeto.gt(0)) {
    throw new PrecioInvalidoError(
      'El precio base neto debe ser mayor que cero',
    );
  }

  if (!comisionMenorcostTasa.gt(0) || !comisionMenorcostTasa.lt(1)) {
    throw new PrecioInvalidoError(
      'La tasa de comisión de Menorcost debe ser mayor que cero y menor que uno',
    );
  }

  if (!tasaMpEstimada.gte(0) || !tasaMpEstimada.lt(1)) {
    throw new PrecioInvalidoError(
      'La tasa estimada de Mercado Pago debe ser mayor o igual a cero y menor que uno',
    );
  }

  const comisionMenorcostMonto = redondearArriba2(
    precioBaseNeto.mul(comisionMenorcostTasa),
  );

  const precioPublico = redondearArriba2(
    precioBaseNeto
      .plus(comisionMenorcostMonto)
      .div(new Prisma.Decimal(1).minus(tasaMpEstimada)),
  );

  const comisionMpEstimada = redondearArriba2(
    precioPublico.mul(tasaMpEstimada),
  );

  const netoEstimadoComerciante = precioPublico
    .minus(comisionMenorcostMonto)
    .minus(comisionMpEstimada);

  // Invariante: con el redondeo hacia arriba, el comerciante nunca debe
  // recibir menos que su precio base neto.
  if (netoEstimadoComerciante.lt(precioBaseNeto)) {
    throw new PrecioInvalidoError(
      'El cálculo generó un neto inferior al precio base neto',
    );
  }

  const resultado: SimulacionPrecioResultado = {
    precioBaseNeto: precioBaseNeto.toFixed(2),
    comisionMenorcostTasa: comisionMenorcostTasa.toFixed(4),
    comisionMenorcostMonto: comisionMenorcostMonto.toFixed(2),
    tasaMpEstimada: tasaMpEstimada.toFixed(4),
    comisionMpEstimada: comisionMpEstimada.toFixed(2),
    precioPublico: precioPublico.toFixed(2),
    netoEstimadoComerciante: netoEstimadoComerciante.toFixed(2),
    advertenciaNeto: ADVERTENCIA_NETO_ESTIMADO,
  };

  if (input.precioLista !== undefined) {
    const precioLista = parseDecimal(input.precioLista, 'precioLista');
    if (!precioLista.gt(0)) {
      throw new PrecioInvalidoError(
        'El precio de lista debe ser mayor que cero',
      );
    }

    resultado.ahorroPorcentaje = precioLista
      .minus(precioPublico)
      .div(precioLista)
      .mul(100)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
      .toFixed(2);
  }

  return resultado;
}
