import { describe, expect, it } from 'vitest';
import { MercadoPagoConfig, Order } from 'mercadopago';

/**
 * Verificación de que el SDK oficial de Mercado Pago (paquete CJS) se puede
 * importar desde el backend ESM (`module: nodenext`). Si este test falla, el
 * adaptador real debe implementarse con `fetch`, como el flujo OAuth.
 */
describe('SDK de Mercado Pago', () => {
  it('expone el cliente de configuración y la API de órdenes', () => {
    const cliente = new MercadoPagoConfig({ accessToken: 'TEST-no-es-real' });
    const ordenes = new Order(cliente);

    expect(typeof ordenes.create).toBe('function');
    expect(typeof ordenes.get).toBe('function');
  });
});
