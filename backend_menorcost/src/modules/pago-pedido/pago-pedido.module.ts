import { Module } from '@nestjs/common';
import { ConfiguracionPagoPedido } from './configuracion-pago-pedido.js';
import { PagoMercadoPagoProveedor } from './pago-mercadopago.proveedor.js';
import { PagoSimuladoProveedor } from './pago-simulado.proveedor.js';
import { PUERTO_PAGOS, type PuertoPagos } from './puerto-pagos.js';

/**
 * Módulo de pagos de un pedido.
 *
 * Punto único de intercambio: el checkout inyecta `PUERTO_PAGOS` y no conoce
 * Mercado Pago. La implementación se elige por `PAGOS_MERCADOPAGO_MODO`.
 *
 * El módulo no se importa todavía en `AppModule`: se conecta al checkout en la
 * etapa B3, junto con la reserva de stock y el webhook.
 */
@Module({
  providers: [
    ConfiguracionPagoPedido,
    PagoSimuladoProveedor,
    PagoMercadoPagoProveedor,
    {
      provide: PUERTO_PAGOS,
      inject: [
        ConfiguracionPagoPedido,
        PagoSimuladoProveedor,
        PagoMercadoPagoProveedor,
      ],
      useFactory: (
        configuracion: ConfiguracionPagoPedido,
        simulado: PagoSimuladoProveedor,
        mercadoPago: PagoMercadoPagoProveedor,
      ): PuertoPagos =>
        configuracion.modo() === 'mercadopago' ? mercadoPago : simulado,
    },
  ],
  exports: [PUERTO_PAGOS, ConfiguracionPagoPedido],
})
export class PagoPedidoModule {}
