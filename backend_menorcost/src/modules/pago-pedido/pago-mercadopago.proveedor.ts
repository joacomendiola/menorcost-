import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  InicioPago,
  ModoPago,
  NotificacionPago,
  PuertoPagos,
  ResultadoNotificacion,
  SolicitudInicioPago,
} from './puerto-pagos.js';

/**
 * Implementación real con Mercado Pago (etapa B5).
 *
 * Queda como stub a propósito: el modo `mercadopago` no debe romper el
 * arranque de la aplicación, solo fallar cuando alguien intenta cobrar.
 *
 * Contrato ya verificado contra la documentación de Mercado Pago (Orders API,
 * producto checkout-pro-orders, `POST /v1/orders`):
 * - `type: 'online'` y `processing_mode: 'manual'`.
 * - `total_amount = solicitud.total` y debe ser igual a la suma de
 *   `unit_price × quantity` de todos los `items`.
 * - `marketplace_fee = solicitud.tarifaServicio` (NO restar la comisión
 *   estimada de MP: el precio público ya la incluye por el gross-up de CU-1.08).
 * - `external_reference = solicitud.referenciaExterna`.
 * - `payer.email` obligatorio si se envía el objeto `payer`.
 * - `expiration_time` ISO 8601 derivado de `solicitud.fechaExpiracion`.
 * - `config.online.success_url / failure_url / pending_url` desde
 *   `solicitud.urlExito / urlFallo / urlPendiente`.
 * - Header `X-Idempotency-Key: solicitud.claveIdempotencia`.
 * - Respuesta: `id` (orden) y `checkout_url` (redirección).
 * - La orden se crea con el access token del vendedor (OAuth), nunca con el
 *   token de la aplicación Menorcost.
 */
@Injectable()
export class PagoMercadoPagoProveedor implements PuertoPagos {
  modo(): ModoPago {
    return 'mercadopago';
  }

  async iniciarPago(_solicitud: SolicitudInicioPago): Promise<InicioPago> {
    throw new ServiceUnavailableException(
      'El pago con Mercado Pago todavía no está habilitado en este entorno.',
    );
  }

  async procesarNotificacion(
    _notificacion: NotificacionPago,
  ): Promise<ResultadoNotificacion> {
    throw new ServiceUnavailableException(
      'Las notificaciones de Mercado Pago todavía no están habilitadas en este entorno.',
    );
  }
}
