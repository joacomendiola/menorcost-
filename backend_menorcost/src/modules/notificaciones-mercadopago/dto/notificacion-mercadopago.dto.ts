import { IsOptional, IsString } from 'class-validator';

/** Query params que Mercado Pago adjunta al POST del webhook. */
export class NotificacionMercadoPagoQueryDto {
  @IsOptional()
  @IsString()
  'data.id'?: string;

  @IsOptional()
  @IsString()
  type?: string;
}

/** Parte del body que usa el flujo (el resto se guarda completo en `payload`). */
export interface CuerpoNotificacionMercadoPago {
  action?: string;
  type?: string;
  data?: {
    id?: string;
    external_reference?: string;
    status?: string;
  };
}
