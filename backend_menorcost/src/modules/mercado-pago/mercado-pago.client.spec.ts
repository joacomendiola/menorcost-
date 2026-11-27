import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MercadoPagoClient } from './mercado-pago.client.js';
import type { MercadoPagoConfigService } from './mercado-pago.config.js';

function respuesta(estado: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('MercadoPagoClient (intercambio OAuth)', () => {
  const config = {
    clientId: vi.fn(() => 'app-id'),
    clientSecret: vi.fn(() => 'app-secret'),
    redirectUri: vi.fn(
      () => 'https://menorcostserver.tail67d69c.ts.net/api/mercadopago/oauth/callback',
    ),
    timeoutMs: vi.fn(() => 1000),
    testToken: vi.fn(() => false),
  };
  const cliente = new MercadoPagoClient(
    config as unknown as MercadoPagoConfigService,
  );
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    config.clientId.mockReturnValue('app-id');
    config.clientSecret.mockReturnValue('app-secret');
    config.redirectUri.mockReturnValue(
      'https://menorcostserver.tail67d69c.ts.net/api/mercadopago/oauth/callback',
    );
    config.timeoutMs.mockReturnValue(1000);
    config.testToken.mockReturnValue(false);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pide un token sandbox cuando MP_TEST_TOKEN está activado', async () => {
    config.testToken.mockReturnValue(true);
    fetchMock.mockResolvedValue(
      respuesta(200, {
        access_token: 'access-sandbox',
        refresh_token: 'refresh-sandbox',
        expires_in: 15_552_000,
        user_id: 123,
        scope: 'read write',
        live_mode: false,
      }),
    );

    const token = await cliente.intercambiarCodigo('codigo', 'verificador');

    expect(token).toEqual({
      accessToken: 'access-sandbox',
      refreshToken: 'refresh-sandbox',
      expiresIn: 15_552_000,
      userId: '123',
      scope: 'read write',
      liveMode: false,
    });

    const [url, opciones] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.mercadopago.com/oauth/token');
    expect(opciones.method).toBe('POST');
    expect(opciones.body).toBe(
      new URLSearchParams({
        client_id: 'app-id',
        client_secret: 'app-secret',
        grant_type: 'authorization_code',
        code: 'codigo',
        redirect_uri:
          'https://menorcostserver.tail67d69c.ts.net/api/mercadopago/oauth/callback',
        code_verifier: 'verificador',
        test_token: 'true',
      }).toString(),
    );
  });

  it('omite test_token cuando MP_TEST_TOKEN está desactivado', async () => {
    fetchMock.mockResolvedValue(
      respuesta(200, {
        access_token: 'access',
        refresh_token: 'refresh',
        expires_in: 100,
        user_id: 123,
      }),
    );

    await cliente.intercambiarCodigo('codigo');

    const cuerpo = new URLSearchParams(fetchMock.mock.calls[0][1].body);
    expect(cuerpo.has('test_token')).toBe(false);
    expect(cuerpo.has('code_verifier')).toBe(false);
  });

  it('traduce un código vencido a codigo_invalido', async () => {
    fetchMock.mockResolvedValue(
      respuesta(400, { error: 'invalid_grant', message: 'code expired' }),
    );

    await expect(cliente.intercambiarCodigo('codigo')).rejects.toMatchObject({
      motivo: 'codigo_invalido',
    });
  });

  it('traduce un error de red a mp_no_disponible', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(cliente.intercambiarCodigo('codigo')).rejects.toMatchObject({
      motivo: 'mp_no_disponible',
    });
  });
});
