import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CanastasModule } from '../canastas/canastas.module.js';
import { PagosMercadoPagoModule } from '../pagos-mercadopago/pagos-mercadopago.module.js';
import { CheckoutExpiracionService } from './checkout-expiracion.service.js';
import { CheckoutController } from './checkout.controller.js';
import { CheckoutService } from './checkout.service.js';
import { FranjasService } from './franjas.service.js';
import { PedidosController } from './pedidos.controller.js';
import { PedidosService } from './pedidos.service.js';

/**
 * Módulo de pedidos y checkout de CU-3.03.
 *
 * El cobro se hace con Mercado Pago a través de `PagosMercadoPagoModule` (credencial
 * OAuth del comercio + Orders API). `CheckoutExpiracionService` libera el stock
 * de los pedidos que vencen sin pagarse.
 */
@Module({
  imports: [AuthModule, CanastasModule, PagosMercadoPagoModule],
  controllers: [CheckoutController, PedidosController],
  providers: [
    CheckoutService,
    PedidosService,
    FranjasService,
    CheckoutExpiracionService,
  ],
})
export class PedidosModule {}
