import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MercadoPagoConfigService } from '../mercado-pago/mercado-pago.config.js';
import { ClienteMercadoPago } from './cliente-mercadopago.js';

const COMERCIO_ID = '11111111-1111-4111-8111-111111111111';

function respuesta(estado: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ClienteMercadoPago (adaptador del SDK)', () => {
  const config = {
    timeoutMs: vi.fn(() => 1000),
    clientId: vi.fn(() => 'app-id'),
    clientSecret: vi.fn(() => 'app-secret'),
  };
  const cliente = new ClienteMercadoPago(
    config as unknown as MercadoPagoConfigService,
  );
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    config.timeoutMs.mockReturnValue(1000);
    config.clientId.mockReturnValue('app-id');
    config.clientSecret.mockReturnValue('app-secret');
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('crea la orden con el token del vendedor y la clave de idempotencia', async () => {
    fetchMock.mockResolvedValue(
      respuesta(201, { id: 'ORD-1', status: 'created', checkout_url: 'https://mp.test/ORD-1' }),
    );

    const orden = await cliente.crearOrden(
      'token-vendedor',
      { type: 'online', total_amount: '100.00' },
      'clave-1',
      COMERCIO_ID,
    );

    expect(orden.checkout_url).toBe('https://mp.test/ORD-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, opciones] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.mercadopago.com/v1/orders');
    expect(opciones.method).toBe('POST');
    expect(opciones.headers.Authorization).toBe('Bearer token-vendedor');
    expect(opciones.headers['X-Idempotency-Key']).toBe('clave-1');
    expect(JSON.parse(opciones.body)).toMatchObject({
      type: 'online',
      total_amount: '100.00',
    });
  });

  it('consulta la orden con GET y sin cuerpo', async () => {
    fetchMock.mockResolvedValue(respuesta(200, { id: 'ORD-1', status: 'processed' }));

    const orden = await cliente.obtenerOrden('token-vendedor', 'ORD-1');

    expect(orden.status).toBe('processed');
    const [url, opciones] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.mercadopago.com/v1/orders/ORD-1');
    expect(opciones.method).toBe('GET');
  });

  it('mapea 401/403 a credencial_invalida', async () => {
    fetchMock.mockResolvedValue(respuesta(401, { message: 'invalid token' }));

    await expect(
      cliente.crearOrden('token', {}, 'clave', COMERCIO_ID),
    ).rejects.toMatchObject({ codigo: 'credencial_invalida' });
  });

  it('mapea 404 a orden_no_encontrada', async () => {
    fetchMock.mockResolvedValue(respuesta(404, { message: 'not found' }));

    await expect(
      cliente.obtenerOrden('token', 'ORD-X'),
    ).rejects.toMatchObject({ codigo: 'orden_no_encontrada' });
  });

  it('mapea 500 a mp_no_disponible y no reintenta la creación', async () => {
    fetchMock.mockResolvedValue(respuesta(500, { message: 'boom' }));

    await expect(
      cliente.crearOrden('token', {}, 'clave', COMERCIO_ID),
    ).rejects.toMatchObject({ codigo: 'mp_no_disponible' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('mapea un error de red a mp_no_disponible', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      cliente.obtenerOrden('token', 'ORD-1'),
    ).rejects.toMatchObject({ codigo: 'mp_no_disponible' });
  });

  it('renueva el token con grant_type=refresh_token', async () => {
    fetchMock.mockResolvedValue(
      respuesta(200, {
        access_token: 'nuevo-access',
        refresh_token: 'nuevo-refresh',
        expires_in: 15_552_000,
      }),
    );

    await expect(
      cliente.refrescarToken('access-viejo', 'refresh-viejo'),
    ).resolves.toEqual({
      access_token: 'nuevo-access',
      refresh_token: 'nuevo-refresh',
      expires_in: 15_552_000,
    });

    const [url, opciones] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.mercadopago.com/oauth/token');
    expect(JSON.parse(opciones.body)).toEqual({
      client_id: 'app-id',
      client_secret: 'app-secret',
      refresh_token: 'refresh-viejo',
      grant_type: 'refresh_token',
    });
  });

  it('un refresh rechazado es credencial_invalida', async () => {
    fetchMock.mockResolvedValue(respuesta(400, { error: 'invalid_grant' }));

    await expect(
      cliente.refrescarToken('access', 'refresh'),
    ).rejects.toMatchObject({ codigo: 'credencial_invalida' });
  });

  it('un refresh sin tokens completos es respuesta_invalida', async () => {
    fetchMock.mockResolvedValue(respuesta(200, { access_token: 'solo-access' }));

    await expect(
      cliente.refrescarToken('access', 'refresh'),
    ).rejects.toMatchObject({ codigo: 'respuesta_invalida' });
  });
});
