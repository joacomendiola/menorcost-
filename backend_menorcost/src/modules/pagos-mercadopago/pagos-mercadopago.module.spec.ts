import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { ConfiguracionPagoPedido } from './configuracion-pago-pedido.js';

function configCon(valores: Record<string, string>): ConfigService {
  return {
    get: (clave: string) => valores[clave],
  } as unknown as ConfigService;
}

describe('ConfiguracionPagoPedido', () => {
  it('la expiración por defecto es de 60 minutos', () => {
    expect(
      new ConfiguracionPagoPedido(configCon({})).minutosExpiracion(),
    ).toBe(60);

    expect(
      new ConfiguracionPagoPedido(
        configCon({ PAGOS_MINUTOS_EXPIRACION: '45' }),
      ).minutosExpiracion(),
    ).toBe(45);

    expect(
      new ConfiguracionPagoPedido(
        configCon({ PAGOS_MINUTOS_EXPIRACION: 'no-es-un-numero' }),
      ).minutosExpiracion(),
    ).toBe(60);
  });

  it('la gracia por defecto es de 5 minutos', () => {
    expect(new ConfiguracionPagoPedido(configCon({})).minutosGracia()).toBe(5);

    expect(
      new ConfiguracionPagoPedido(
        configCon({ PAGOS_MINUTOS_GRACIA: '10' }),
      ).minutosGracia(),
    ).toBe(10);
  });

  it('arma las URLs de retorno sobre FRONTEND_URL con el id del pedido', () => {
    const urls = new ConfiguracionPagoPedido(
      configCon({ FRONTEND_URL: 'https://menorcost.test/' }),
    ).urlsRetorno('pedido-1');

    expect(urls.exito).toBe(
      'https://menorcost.test/checkout/resultado?estado=aprobado&idPedido=pedido-1',
    );
    expect(urls.fallo).toBe(
      'https://menorcost.test/checkout/resultado?estado=rechazado&idPedido=pedido-1',
    );
    expect(urls.pendiente).toBe(
      'https://menorcost.test/checkout/resultado?estado=pendiente&idPedido=pedido-1',
    );
  });

  it('no falla al construirse sin variables de Mercado Pago y sí al usarlas', () => {
    const configuracion = new ConfiguracionPagoPedido(configCon({}));

    expect(() => configuracion.urlWebhook()).toThrowError(/MP_URL_PUBLICA/);
    expect(() => configuracion.secretoWebhook()).toThrowError(
      /MP_WEBHOOK_SECRET/,
    );
  });

  it('compone la URL del webhook sin barra duplicada', () => {
    const configuracion = new ConfiguracionPagoPedido(
      configCon({ MP_URL_PUBLICA: 'https://api.menorcost.test/' }),
    );

    expect(configuracion.urlWebhook()).toBe(
      'https://api.menorcost.test/notificaciones-mercadopago',
    );
  });
});
