import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { ConfiguracionPagoPedido } from './configuracion-pago-pedido.js';
import { PagoMercadoPagoProveedor } from './pago-mercadopago.proveedor.js';
import { PagoPedidoModule } from './pago-pedido.module.js';
import { PagoSimuladoProveedor } from './pago-simulado.proveedor.js';
import {
  PUERTO_PAGOS,
  type PuertoPagos,
  type SolicitudInicioPago,
} from './puerto-pagos.js';

function configCon(valores: Record<string, string>): ConfigService {
  return {
    get: (clave: string) => valores[clave],
  } as unknown as ConfigService;
}

function solicitudBase(
  cambios: Partial<SolicitudInicioPago> = {},
): SolicitudInicioPago {
  return {
    idPedido: '11111111-1111-4111-8111-111111111111',
    referenciaExterna: '11111111-1111-4111-8111-111111111111',
    claveIdempotencia: '22222222-2222-4222-8222-222222222222',
    moneda: 'ARS',
    total: '100.00',
    tarifaServicio: '10.00',
    tasaMpEstimada: '0.0650',
    items: [{ titulo: 'Yerba 1kg', cantidad: 1, precioUnitario: '100.00' }],
    emailPagador: 'cliente@ejemplo.com',
    fechaExpiracion: new Date('2026-11-20T15:00:00.000Z'),
    urlExito: 'http://localhost:5173/checkout/resultado?estado=aprobado',
    urlFallo: 'http://localhost:5173/checkout/resultado?estado=rechazado',
    urlPendiente: 'http://localhost:5173/checkout/resultado?estado=pendiente',
    ...cambios,
  };
}

async function armarModulo(valores: Record<string, string>) {
  // `ConfigModule` es global en `AppModule` (`ConfigModule.forRoot`), así que en
  // producción `ConfigService` llega sin importarlo. En el test hay que
  // registrarlo para poder reemplazarlo por valores fijos.
  const modulo = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      PagoPedidoModule,
    ],
  })
    .overrideProvider(ConfigService)
    .useValue(configCon(valores))
    .compile();

  return modulo;
}

describe('ConfiguracionPagoPedido', () => {
  it('modo simulado por defecto', () => {
    const configuracion = new ConfiguracionPagoPedido(configCon({}));

    expect(configuracion.modo()).toBe('simulado');
  });

  it('acepta mercadopago y su alias real', () => {
    expect(
      new ConfiguracionPagoPedido(
        configCon({ PAGOS_MERCADOPAGO_MODO: 'mercadopago' }),
      ).modo(),
    ).toBe('mercadopago');

    expect(
      new ConfiguracionPagoPedido(
        configCon({ PAGOS_MERCADOPAGO_MODO: 'REAL' }),
      ).modo(),
    ).toBe('mercadopago');
  });

  it('un valor desconocido cae en simulado', () => {
    const configuracion = new ConfiguracionPagoPedido(
      configCon({ PAGOS_MERCADOPAGO_MODO: 'produccion' }),
    );

    expect(configuracion.modo()).toBe('simulado');
  });

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

  it('arma las URLs de retorno sobre FRONTEND_URL', () => {
    const urls = new ConfiguracionPagoPedido(
      configCon({ FRONTEND_URL: 'https://menorcost.test/' }),
    ).urlsRetorno();

    expect(urls.exito).toBe(
      'https://menorcost.test/checkout/resultado?estado=aprobado',
    );
    expect(urls.fallo).toBe(
      'https://menorcost.test/checkout/resultado?estado=rechazado',
    );
    expect(urls.pendiente).toBe(
      'https://menorcost.test/checkout/resultado?estado=pendiente',
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

describe('PagoSimuladoProveedor', () => {
  it('aprueba con comprobante y comisión estimada redondeada hacia arriba', async () => {
    const proveedor = new PagoSimuladoProveedor();
    const inicio = await proveedor.iniciarPago(
      solicitudBase({ total: '10.01', tasaMpEstimada: '0.0650' }),
    );

    expect(inicio.requiereRedireccion).toBe(false);
    expect(inicio.urlRedireccion).toBeNull();
    expect(inicio.mpOrderId).toBeNull();
    expect(inicio.resultadoInmediato?.aprobado).toBe(true);
    expect(inicio.resultadoInmediato?.estadoPago).toBe('PAGADO');
    expect(inicio.resultadoInmediato?.comisionMp).toBe('0.66');
    expect(inicio.resultadoInmediato?.nroComprobante).toMatch(/^SIM-\d{8}-/);
  });

  it('rechaza sin comprobante y con comisión en cero', async () => {
    const proveedor = new PagoSimuladoProveedor();
    const inicio = await proveedor.iniciarPago(
      solicitudBase({ resultadoSimulado: 'RECHAZADO' }),
    );

    expect(inicio.requiereRedireccion).toBe(false);
    expect(inicio.resultadoInmediato).toEqual({
      aprobado: false,
      estadoPago: 'RECHAZADO',
      nroComprobante: null,
      mpPaymentId: null,
      comisionMp: '0.00',
    });
  });

  it('sin resultado explícito aprueba', async () => {
    const proveedor = new PagoSimuladoProveedor();
    const inicio = await proveedor.iniciarPago(solicitudBase());

    expect(inicio.resultadoInmediato?.aprobado).toBe(true);
  });

  it('ignora las notificaciones sin romper', async () => {
    const proveedor = new PagoSimuladoProveedor();

    await expect(
      proveedor.procesarNotificacion({
        claveUnica: 'evento-1',
        topico: 'order',
        accion: 'order.updated',
        idRecurso: 'ORD01',
        referenciaExterna: null,
        payload: {},
      }),
    ).resolves.toEqual({
      atendida: false,
      detalle: 'El modo simulado no procesa notificaciones de Mercado Pago.',
    });
  });
});

describe('PagoMercadoPagoProveedor', () => {
  it('falla al usarse y no al construirse', async () => {
    const proveedor = new PagoMercadoPagoProveedor();

    expect(proveedor.modo()).toBe('mercadopago');
    await expect(proveedor.iniciarPago(solicitudBase())).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

describe('PagoPedidoModule', () => {
  it('en modo simulado inyecta el proveedor simulado', async () => {
    const modulo = await armarModulo({});
    const puerto = modulo.get<PuertoPagos>(PUERTO_PAGOS);

    expect(puerto.modo()).toBe('simulado');

    await modulo.close();
  });

  it('en modo mercadopago inyecta el proveedor real', async () => {
    const modulo = await armarModulo({
      PAGOS_MERCADOPAGO_MODO: 'mercadopago',
    });
    const puerto = modulo.get<PuertoPagos>(PUERTO_PAGOS);

    expect(puerto.modo()).toBe('mercadopago');
    await expect(puerto.iniciarPago(solicitudBase())).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    await modulo.close();
  });
});
