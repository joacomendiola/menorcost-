import {
  InvalidWebhookSignatureError,
  SignatureFailureReason,
  WebhookSignatureValidator,
} from 'mercadopago';

export interface EncabezadosFirmaMp {
  xSignature?: string;
  xRequestId?: string;
}

/** Ventana anti-replay: 5 minutos. */
const TOLERANCIA_MS = 5 * 60 * 1000;

/**
 * Validación de la firma de las notificaciones de Mercado Pago.
 *
 * El HMAC-SHA256 lo calcula el SDK oficial sobre el manifiesto
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` y lo compara con `v1` del
 * header `x-signature` en tiempo constante.
 *
 * La antigüedad se valida aparte: `toleranceSeconds` del SDK siempre multiplica
 * `ts` por 1000, mientras que los ejemplos oficiales de MP lo envían en
 * milisegundos (`ts=1742505638683`). Usar esa opción rechaza notificaciones
 * válidas. Aceptamos también segundos por compatibilidad.
 */
export function validarFirmaWebhook(
  encabezados: EncabezadosFirmaMp,
  dataId: string | undefined,
  secreto: string,
): void {
  // Primero autenticidad: si el HMAC no coincide, no hay nada más que revisar.
  WebhookSignatureValidator.validate({
    xSignature: encabezados.xSignature ?? null,
    xRequestId: encabezados.xRequestId ?? null,
    dataId: dataId ?? null,
    secret: secreto,
  });

  validarAntiguedad(encabezados.xSignature);
}

function validarAntiguedad(xSignature: string | undefined): void {
  const ts = /(?:^|,)\s*ts=(\d+)/.exec(xSignature ?? '')?.[1];

  // Si no hay timestamp parseable, el SDK ya lo reportó como header inválido.
  if (!ts) return;

  const numero = Number(ts);
  const timestampMs = numero < 1_000_000_000_000 ? numero * 1000 : numero;

  if (Math.abs(Date.now() - timestampMs) > TOLERANCIA_MS) {
    throw new InvalidWebhookSignatureError(
      SignatureFailureReason.TimestampOutOfTolerance,
      undefined,
      ts,
    );
  }
}

export { InvalidWebhookSignatureError };
