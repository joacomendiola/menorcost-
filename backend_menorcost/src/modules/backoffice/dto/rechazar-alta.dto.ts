import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RechazarAltaDto {
  @IsNotEmpty({ message: 'El motivo de rechazo es obligatorio' })
  @IsString()
  @MaxLength(500)
  motivo: string;
}