import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CrearDireccionDto } from '../../direcciones/dto/crear-direccion.dto.js';

export class RegistroDto {
  @IsString()
  @Matches(/^\d{7,8}$/, { message: 'El DNI debe tener 7 u 8 dígitos' })
  dni!: string;

  @IsString()
  @MinLength(2, { message: 'El nombre es obligatorio' })
  @MaxLength(60)
  nombre!: string;

  @IsString()
  @MinLength(2, { message: 'El apellido es obligatorio' })
  @MaxLength(60)
  apellido!: string;

  @IsDateString({}, { message: 'La fecha de nacimiento no es válida' })
  fechaNacimiento!: string;

  @IsString()
  @Matches(/^[0-9+\-\s]{6,20}$/, { message: 'El teléfono no es válido' })
  telefono!: string;

  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CrearDireccionDto)
  direccion?: CrearDireccionDto;
}
