import { describe, expect, it } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import {
  construirOrdenMercadoPago,
  urlCheckoutDeOrden,
} from './orden-mercadopago.js';

const datos = {
  idPedido: 'pedido-1',
  nroPedido: 'MC-20261122-ABC123',
  nombreComercio: 'Almacén del Centro',
  emailComprador: 'cliente@menorcost.test',
  total: new Prisma.Decimal('9411.78'),
  tarifaServicio: new Prisma.Decimal('200.00'),
  items: [
    {
      titulo: 'Yogur entero',
      cantidad: 2,
      precioUnitario: new Prisma.Decimal('4705.89'),
    },
  ],
  urlsRetorno: {
    exito: 'https://menorcost.test/checkout/resultado?estado=aprobado&idPedido=pedido-1',
    fallo: 'https://menorcost.test/checkout/resultado?estado=rechazado&idPedido=pedido-1',
    pendiente:
      'https://menorcost.test/checkout/resultado?estado=pendiente&idPedido=pedido-1',
  },
  urlWebhook: 'https://api.menorcost.test/notificaciones-mercadopago',
  minutosExpiracion: 60,
};

describe('construirOrdenMercadoPago', () => {
  it('arma una order de Checkout Pro con marketplace_fee igual a la tarifa de servicio', () => {
    const orden = construirOrdenMercadoPago(datos);

    expect(orden.type).toBe('online');
    expect(orden.processing_mode).toBe('manual');
    expect(orden.external_reference).toBe('pedido-1');
    expect(orden.total_amount).toBe('9411.78');
    expect(orden.marketplace_fee).toBe('200.00');
    expect(orden.expiration_time).toBe('PT60M');
    expect(orden.payer).toEqual({ email: 'cliente@menorcost.test' });
    expect(orden.description).toContain('MC-20261122-ABC123');
    expect(orden.description).toContain('Almacén del Centro');
  });

  it('los items suman exactamente el total y van como string', () => {
    const orden = construirOrdenMercadoPago(datos);

    expect(orden.items).toEqual([
      { title: 'Yogur entero', quantity: 2, unit_price: '4705.89' },
    ]);

    const suma = (orden.items ?? []).reduce(
      (acumulado, item) =>
        acumulado + Number(item.unit_price) * (item.quantity ?? 0),
      0,
    );
    expect(suma.toFixed(2)).toBe(orden.total_amount);
  });

  it('configura las tres URLs de retorno, el auto_return y el webhook', () => {
    const orden = construirOrdenMercadoPago(datos);

    expect(orden.config?.online).toEqual({
      success_url: datos.urlsRetorno.exito,
      failure_url: datos.urlsRetorno.fallo,
      pending_url: datos.urlsRetorno.pendiente,
      auto_return: 'approved',
      callback_url: datos.urlWebhook,
    });
  });
});

describe('urlCheckoutDeOrden', () => {
  it('reconstruye la URL de pago a partir del id de la order', () => {
    expect(urlCheckoutDeOrden('ORDTST01KS5AJ6')).toBe(
      'https://www.mercadopago.com.ar/checkout/v1/redirect?order_id=ORDTST01KS5AJ6',
    );
  });
});
