import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

/** Query params que Mercado Pago adjunta al POST del webhook. */
export class NotificacionMercadoPagoQueryDto {
  // Sin este mapeo, class-transformer no copia el parámetro con punto al DTO.
  @Expose({ name: 'data.id' })
  @IsOptional()
  @IsString()
  dataId?: string;

  @IsOptional()
  @IsString()
  type?: string;
}

/** Parte del body que usa el flujo (el resto se guarda completo en `payload`). */
export interface CuerpoNotificacionMercadoPago {
  /** Identificador único de la notificación enviado por Mercado Pago. */
  id?: string | number;
  action?: string;
  type?: string;
  data?: {
    id?: string;
    external_reference?: string;
    status?: string;
  };
}
