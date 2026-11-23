import { plainToInstance } from 'class-transformer';
import { describe, expect, it } from 'vitest';
import { NotificacionMercadoPagoQueryDto } from './notificacion-mercadopago.dto.js';

describe('NotificacionMercadoPagoQueryDto', () => {
  it('mapea el query param data.id de Mercado Pago a dataId', () => {
    const dto = plainToInstance(NotificacionMercadoPagoQueryDto, {
      'data.id': 'ORD-1',
      type: 'order',
    });

    expect(dto.dataId).toBe('ORD-1');
    expect(dto.type).toBe('order');
  });
});
