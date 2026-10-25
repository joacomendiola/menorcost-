import { IsBoolean } from 'class-validator';

export class ActualizarAperturaDto {
  @IsBoolean()
  abierto!: boolean;
}
