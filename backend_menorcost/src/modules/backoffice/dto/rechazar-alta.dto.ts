import { IsNotEmpty, IsString } from 'class-validator';

export class RechazarAltaDto {
  @IsNotEmpty({ message: 'El motivo de rechazo es obligatorio' })
  @IsString()
  motivo: string;
}