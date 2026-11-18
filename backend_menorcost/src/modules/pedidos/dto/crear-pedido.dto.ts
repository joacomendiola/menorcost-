import { IsIn, IsOptional, IsUUID, MaxLength } from 'class-validator';
import {
  RESULTADOS_PAGO_SIMULADO,
  type ResultadoPagoSimulado,
} from './resultado-pago-simulado.js';

export class CrearPedidoDto {
  @IsUUID()
  comercioId!: string;

  @IsUUID()
  franjaHorarioId!: string;

  /**
   * Clave de idempotencia generada por el frontend al abrir el checkout.
   * Dos requests con la misma clave producen un solo pedido.
   */
  @IsOptional()
  @MaxLength(64)
  idempotencyKey?: string;

  /**
   * Solo para el modo simulación: define si el pago mock se aprueba o se
   * rechaza. El frontend nunca decide el monto, solo el resultado del cobro.
   * Cuando se integre Mercado Pago, este campo desaparece.
   */
  @IsOptional()
  @IsIn(RESULTADOS_PAGO_SIMULADO)
  resultadoPagoSimulado?: ResultadoPagoSimulado;
}
