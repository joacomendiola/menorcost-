import {
  InvalidWebhookSignatureError,
  WebhookSignatureValidator,
} from 'mercadopago';

export interface EncabezadosFirmaMp {
  xSignature?: string;
  xRequestId?: string;
}

/**
 * Validación de la firma de las notificaciones de Mercado Pago.
 *
 * Usa el validador del SDK oficial, que implementa el HMAC-SHA256 del
 * manifiesto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` y compara con
 * `v1` del header `x-signature` en tiempo constante.
 *
 * La firma no depende del body: se valida con `data.id` + headers, por eso no
 * hace falta recalcular nada sobre el JSON. `toleranceSeconds` limita replay.
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
    toleranceSeconds: 300,
  });
}

export { InvalidWebhookSignatureError };
