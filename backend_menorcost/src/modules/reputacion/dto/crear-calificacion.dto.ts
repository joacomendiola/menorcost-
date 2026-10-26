import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CrearCalificacionDto {
  @IsNotEmpty()
  @IsUUID()
  idPedido: string;

  @IsInt()
  @Min(1)
  @Max(5)
  puntaje: number;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  comentario?: string;
}