import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CanastasModule } from '../canastas/canastas.module.js';
import { CheckoutController } from './checkout.controller.js';
import { CheckoutService } from './checkout.service.js';
import { FranjasService } from './franjas.service.js';
import { PedidosController } from './pedidos.controller.js';
import { PedidosService } from './pedidos.service.js';

/**
 * Módulo de checkout de CU-3.03.
 *
 * El cobro se resuelve con Mercado Pago: el checkout solo arma el resumen y,
 * cuando la integración esté conectada, delega la creación de la orden y la
 * confirmación del pago al módulo `pago-pedido`.
 */
@Module({
  imports: [AuthModule, CanastasModule],
  controllers: [CheckoutController, PedidosController],
  providers: [CheckoutService, PedidosService, FranjasService],
})
export class PedidosModule {}
