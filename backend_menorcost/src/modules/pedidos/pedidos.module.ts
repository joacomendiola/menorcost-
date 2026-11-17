import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CanastasModule } from '../canastas/canastas.module.js';
import { CheckoutController } from './checkout.controller.js';
import { CheckoutService } from './checkout.service.js';
import { FranjasService } from './franjas.service.js';
import {
  PASARELA_PAGO,
  PagoSimuladoService,
} from './pago-simulado.service.js';

/**
 * Módulo de checkout de CU-3.03.
 *
 * `PASARELA_PAGO` es el único punto de intercambio: cuando entre el Split
 * Payment real de Mercado Pago, se registra otra implementación acá y el resto
 * del módulo no cambia.
 */
@Module({
  imports: [AuthModule, CanastasModule],
  controllers: [CheckoutController],
  providers: [
    CheckoutService,
    FranjasService,
    PagoSimuladoService,
    { provide: PASARELA_PAGO, useExisting: PagoSimuladoService },
  ],
})
export class PedidosModule {}
