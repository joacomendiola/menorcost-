import { IsString, MaxLength, MinLength } from 'class-validator';

export class SolicitarBajaDto {
  @IsString()
  @MinLength(1, { message: 'El motivo de la baja es obligatorio' })
  @MaxLength(500)
  motivo!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password!: string;
}
