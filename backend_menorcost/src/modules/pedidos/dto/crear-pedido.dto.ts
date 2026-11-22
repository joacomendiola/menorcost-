import { IsOptional, IsUUID, MaxLength } from 'class-validator';

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
}
