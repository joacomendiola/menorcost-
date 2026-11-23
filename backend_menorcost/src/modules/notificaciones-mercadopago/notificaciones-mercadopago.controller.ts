import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
// El DTO de `@Query()` va como import de valor: con `import type` el decorador
// emite `Function` en `design:paramtypes` y `ValidationPipe` no transforma la
// query (`data.id` nunca llega a `dataId`).
import {
  NotificacionMercadoPagoQueryDto,
  type CuerpoNotificacionMercadoPago,
} from './dto/notificacion-mercadopago.dto.js';
import { InvalidWebhookSignatureError } from './firma-webhook-mercadopago.js';
import { NotificacionesMercadoPagoService } from './notificaciones-mercadopago.service.js';

/**
 * Endpoint público del webhook: no lleva guards porque lo llama Mercado Pago.
 * La autenticidad se valida con la firma HMAC (`x-signature` + secreto del
 * panel de Webhooks), igual que el callback de OAuth se protege con `state`.
 */
@Controller('notificaciones-mercadopago')
export class NotificacionesMercadoPagoController {
  constructor(
    private readonly servicio: NotificacionesMercadoPagoService,
  ) {}

  @Post()
  @HttpCode(200)
  async recibir(
    @Query() query: NotificacionMercadoPagoQueryDto,
    @Body() cuerpo: CuerpoNotificacionMercadoPago,
    @Headers('x-signature') xSignature?: string,
    @Headers('x-request-id') xRequestId?: string,
  ) {
    try {
      return await this.servicio.procesar(query, cuerpo, {
        xSignature,
        xRequestId,
      });
    } catch (error) {
      if (error instanceof InvalidWebhookSignatureError) {
        throw new UnauthorizedException(
          'La firma de la notificación no es válida.',
        );
      }

      throw error;
    }
  }
}
