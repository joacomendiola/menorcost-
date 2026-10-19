import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ActualizarPerfilDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'El nombre es demasiado corto' })
  @MaxLength(60)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'El apellido es demasiado corto' })
  @MaxLength(60)
  apellido?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s]{6,20}$/, { message: 'El teléfono no es válido' })
  telefono?: string;
}
