import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { MercadoPagoClient } from './mercado-pago.client.js';
import { MercadoPagoConfigService } from './mercado-pago.config.js';
import { MercadoPagoCryptoService } from './mercado-pago-crypto.service.js';
import { MercadoPagoController } from './mercado-pago.controller.js';
import { MercadoPagoService } from './mercado-pago.service.js';
import { MercadoPagoStateService } from './mercado-pago-state.service.js';

/**
 * Módulo aislado de CU-1.09: todo el flujo OAuth de Mercado Pago vive acá.
 * No modifica `Comercio.estado` ni depende de checkout/split.
 */
@Module({
  imports: [AuthModule, JwtModule.register({})],
  controllers: [MercadoPagoController],
  providers: [
    MercadoPagoService,
    MercadoPagoClient,
    MercadoPagoConfigService,
    MercadoPagoCryptoService,
    MercadoPagoStateService,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [MercadoPagoConfigService, MercadoPagoCryptoService],
})
export class MercadoPagoModule {}
