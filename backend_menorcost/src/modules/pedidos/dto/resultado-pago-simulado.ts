export const RESULTADOS_PAGO_SIMULADO = ['APROBADO', 'RECHAZADO'] as const;

export type ResultadoPagoSimulado = (typeof RESULTADOS_PAGO_SIMULADO)[number];
