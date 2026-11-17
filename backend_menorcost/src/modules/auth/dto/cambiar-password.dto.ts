import { IsString, MinLength } from 'class-validator';

export class CambiarPasswordDto {
  @IsString()
  @MinLength(1, { message: 'La contraseña actual es obligatoria' })
  passwordActual!: string;

  @IsString()
  @MinLength(8, {
    message: 'La nueva contraseña debe tener al menos 8 caracteres',
  })
  passwordNueva!: string;
}
