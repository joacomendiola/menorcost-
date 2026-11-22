import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  InvalidWebhookSignatureError,
  validarFirmaWebhook,
} from './firma-webhook-mercadopago.js';

const SECRETO = 'secreto-del-panel-de-webhooks';

function encabezados(
  dataId: string,
  requestId: string,
  ts = Math.floor(Date.now() / 1000),
) {
  const manifiesto = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac('sha256', SECRETO).update(manifiesto).digest('hex');

  return { xSignature: `ts=${ts},v1=${v1}`, xRequestId: requestId };
}

describe('validarFirmaWebhook', () => {
  it('acepta una firma válida de Mercado Pago', () => {
    expect(() =>
      validarFirmaWebhook(encabezados('ORD-1', 'req-1'), 'ORD-1', SECRETO),
    ).not.toThrow();
  });

  it('rechaza si el secreto no es el del panel de Webhooks', () => {
    expect(() =>
      validarFirmaWebhook(encabezados('ORD-1', 'req-1'), 'ORD-1', 'otro-secreto'),
    ).toThrow(InvalidWebhookSignatureError);
  });

  it('rechaza si el data.id no es el que se firmó', () => {
    expect(() =>
      validarFirmaWebhook(encabezados('ORD-1', 'req-1'), 'ORD-OTRA', SECRETO),
    ).toThrow(InvalidWebhookSignatureError);
  });

  it('rechaza si se altera el x-request-id', () => {
    const firma = { ...encabezados('ORD-1', 'req-1'), xRequestId: 'req-trucho' };

    expect(() => validarFirmaWebhook(firma, 'ORD-1', SECRETO)).toThrow(
      InvalidWebhookSignatureError,
    );
  });

  it('rechaza una firma vieja (replay fuera de tolerancia)', () => {
    const ts = Math.floor(Date.now() / 1000) - 10 * 60;

    expect(() =>
      validarFirmaWebhook(encabezados('ORD-1', 'req-1', ts), 'ORD-1', SECRETO),
    ).toThrow(InvalidWebhookSignatureError);
  });

  it('rechaza si falta el header x-signature', () => {
    expect(() =>
      validarFirmaWebhook({ xRequestId: 'req-1' }, 'ORD-1', SECRETO),
    ).toThrow(InvalidWebhookSignatureError);
  });
});
