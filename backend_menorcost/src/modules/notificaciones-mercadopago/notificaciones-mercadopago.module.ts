import { Module } from '@nestjs/common';
import { PagosMercadoPagoModule } from '../pagos-mercadopago/pagos-mercadopago.module.js';
import { NotificacionesMercadoPagoController } from './notificaciones-mercadopago.controller.js';
import { NotificacionesMercadoPagoService } from './notificaciones-mercadopago.service.js';

/**
 * Webhooks de Mercado Pago (CU-3.03): recepción, validación de firma y
 * confirmación del pago de un pedido.
 */
@Module({
  imports: [PagosMercadoPagoModule],
  controllers: [NotificacionesMercadoPagoController],
  providers: [NotificacionesMercadoPagoService],
})
export class NotificacionesMercadoPagoModule {}
