import { Module } from '@nestjs/common';
import { MercadoPagoModule } from '../mercado-pago/mercado-pago.module.js';
import { ClienteMercadoPago } from './cliente-mercadopago.js';
import { ConfiguracionPagoPedido } from './configuracion-pago-pedido.js';
import { CredencialMercadoPagoService } from './credencial-mercadopago.service.js';

/**
 * Módulo de pagos de un pedido con Mercado Pago.
 *
 * Reúne la configuración del flujo (expiración de la reserva, URLs de retorno
 * y secreto del webhook), el cliente HTTP de Mercado Pago y la credencial OAuth
 * del comercio lista para cobrar. El checkout de `pedidos` lo consume.
 */
@Module({
  imports: [MercadoPagoModule],
  providers: [
    ConfiguracionPagoPedido,
    ClienteMercadoPago,
    CredencialMercadoPagoService,
  ],
  exports: [
    ConfiguracionPagoPedido,
    ClienteMercadoPago,
    CredencialMercadoPagoService,
  ],
})
export class PagosMercadoPagoModule {}
