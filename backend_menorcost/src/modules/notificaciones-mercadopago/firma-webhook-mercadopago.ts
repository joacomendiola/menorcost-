import {
  InvalidWebhookSignatureError,
  WebhookSignatureValidator,
} from 'mercadopago';

export interface EncabezadosFirmaMp {
  xSignature?: string;
  xRequestId?: string;
}

/** Ventana anti-replay recomendada para las firmas de Mercado Pago. */
const TOLERANCIA_SEGUNDOS = 5 * 60;

/**
 * Validación de la firma de las notificaciones de Mercado Pago.
 *
 * El HMAC-SHA256 lo hace el SDK oficial sobre el manifiesto
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` y lo compara con `v1` del
 * header `x-signature` en tiempo constante.
 *
 * Mercado Pago envía `ts` en segundos. `toleranceSeconds` del SDK aplica una
 * ventana anti-replay sobre ese mismo formato.
 */
export function validarFirmaWebhook(
  encabezados: EncabezadosFirmaMp,
  dataId: string | undefined,
  secreto: string,
): void {
  WebhookSignatureValidator.validate({
    xSignature: encabezados.xSignature ?? null,
    xRequestId: encabezados.xRequestId ?? null,
    dataId: dataId ?? null,
    secret: secreto,
    toleranceSeconds: TOLERANCIA_SEGUNDOS,
  });
}

export { InvalidWebhookSignatureError };
