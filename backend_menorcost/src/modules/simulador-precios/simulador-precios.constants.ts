/**
 * Tasa estimada de comisión de Mercado Pago usada por el simulador.
 * Es una constante de código: el costo real puede variar según el medio de pago
 * y la cantidad de cuotas. Para el Split Payment real se usa el valor que
 * informe Mercado Pago al confirmar el pago.
 */
export const MP_FEE_ESTIMADA = '0.0650';

export const ADVERTENCIA_NETO_ESTIMADO =
  'El monto neto a recibir es un estimado; el valor exacto liquidado puede variar levemente según el medio de pago que utilice el cliente en Mercado Pago';
