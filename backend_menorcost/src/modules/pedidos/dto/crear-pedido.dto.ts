import { IsIn, IsOptional, IsUUID } from 'class-validator';
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
   * Solo para el modo simulación: define si el pago mock se aprueba o se
   * rechaza. El frontend nunca decide el monto, solo el resultado del cobro.
   * Cuando se integre Mercado Pago, este campo desaparece.
   */
  @IsOptional()
  @IsIn(RESULTADOS_PAGO_SIMULADO)
  resultadoPagoSimulado?: ResultadoPagoSimulado;
}
