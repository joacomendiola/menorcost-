/**
 * Contrato de pagos de un pedido.
 *
 * El checkout nunca habla con Mercado Pago: pide iniciar un pago y delega en
 * la implementación configurada. Eso permite cambiar entre el cobro simulado
 * y el cobro real sin tocar `checkout.service.ts` ni las transacciones.
 *
 * Reglas de dinero (AGENTS.md):
 * - Los montos viajan como `string` con 2 decimales, nunca como `number`.
 * - `marketplace_fee = tarifaServicio`. NO se resta la comisión estimada de
 *   Mercado Pago: el precio público del Sprint 1 (CU-1.08) ya incluye ese
 *   gross-up.
 */

/** Token de inyección del puerto de pagos. */
export const PUERTO_PAGOS = Symbol('PUERTO_PAGOS');

export type ModoPago = 'simulado' | 'mercadopago';

export type ResultadoPagoSimulado = 'APROBADO' | 'RECHAZADO';

/** Tipo de comprobante que devuelve el puerto en un cobro inmediato. */
export type EstadoPagoInmediato = 'PAGADO' | 'RECHAZADO';

export interface ItemPago {
  titulo: string;
  cantidad: number;
  /** Precio unitario final, con 2 decimales. */
  precioUnitario: string;
}

/**
 * Todo lo necesario para iniciar un pago. Está pensado para que la creación
 * de la orden de Mercado Pago (B5) no necesite consultar nada más.
 */
export interface SolicitudInicioPago {
  /** Id interno del pedido (uuid). */
  idPedido: string;
  /** `external_reference` que viaja a Mercado Pago. */
  referenciaExterna: string;
  /** `X-Idempotency-Key` de la orden. */
  claveIdempotencia: string;
  moneda: string;
  /** `total_amount`: incluye el gross-up de Mercado Pago. */
  total: string;
  /** `marketplace_fee`: comisión de Menorcost congelada en el pedido. */
  tarifaServicio: string;
  /** Tasa estimada de MP, usada solo para el cobro simulado y la conciliación. */
  tasaMpEstimada: string;
  items: readonly ItemPago[];
  emailPagador: string | null;
  /** Vencimiento de la reserva de stock y de la orden en Mercado Pago. */
  fechaExpiracion: Date;
  urlExito: string;
  urlFallo: string;
  urlPendiente: string;
  /** Solo modo simulado: fuerza el resultado del cobro. */
  resultadoSimulado?: ResultadoPagoSimulado;
}

/** Resultado de un cobro que se resolvió sin salir de la aplicación. */
export interface ResultadoInmediatoPago {
  aprobado: boolean;
  estadoPago: EstadoPagoInmediato;
  nroComprobante: string | null;
  mpPaymentId: string | null;
  /** Comisión de MP estimada; con Mercado Pago real la informa la API. */
  comisionMp: string;
}

export interface InicioPago {
  /** `true` cuando el comprador debe ir a Mercado Pago para pagar. */
  requiereRedireccion: boolean;
  /** `checkout_url` de la orden; `null` en el modo simulado. */
  urlRedireccion: string | null;
  referenciaExterna: string;
  /** Id de la orden de Mercado Pago; `null` en el modo simulado. */
  mpOrderId: string | null;
  /** Presente solo cuando `requiereRedireccion` es `false`. */
  resultadoInmediato: ResultadoInmediatoPago | null;
}

/** Notificación (webhook) ya normalizada por el adaptador. */
export interface NotificacionPago {
  /** Clave de idempotencia: dos notificaciones iguales producen un solo efecto. */
  claveUnica: string;
  topico: string;
  accion: string | null;
  idRecurso: string | null;
  referenciaExterna: string | null;
  payload: unknown;
}

export interface ResultadoNotificacion {
  atendida: boolean;
  detalle: string;
}

export interface PuertoPagos {
  modo(): ModoPago;
  iniciarPago(solicitud: SolicitudInicioPago): Promise<InicioPago>;
  procesarNotificacion(
    notificacion: NotificacionPago,
  ): Promise<ResultadoNotificacion>;
}
