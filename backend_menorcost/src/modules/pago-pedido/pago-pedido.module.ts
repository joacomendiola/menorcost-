import { Module } from '@nestjs/common';
import { ConfiguracionPagoPedido } from './configuracion-pago-pedido.js';

/**
 * Módulo de pagos de un pedido.
 *
 * Por ahora solo expone la configuración del flujo (expiración de la reserva,
 * URLs de retorno y secreto del webhook). El cliente HTTP de Mercado Pago y la
 * reserva de stock se conectan al checkout en la etapa de integración.
 */
@Module({
  providers: [ConfiguracionPagoPedido],
  exports: [ConfiguracionPagoPedido],
})
export class PagoPedidoModule {}
