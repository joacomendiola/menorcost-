import { IsString, MinLength } from 'class-validator';

export class RestablecerPasswordDto {
  @IsString()
  @MinLength(1, { message: 'El token es obligatorio' })
  token!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password!: string;
}
