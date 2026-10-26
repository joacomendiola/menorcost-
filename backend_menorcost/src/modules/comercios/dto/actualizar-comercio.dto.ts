import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ActualizarComercioDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'El nombre de fantasía es obligatorio' })
  @MaxLength(120)
  nombreFantasia?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'La razón social es obligatoria' })
  @MaxLength(160)
  razonSocial?: string;

  @IsOptional()
  @Matches(/^\d{11}$/, { message: 'El CUIT debe tener 11 dígitos' })
  cuit?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'El teléfono es obligatorio' })
  @MaxLength(30)
  telefono?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'La calle es obligatoria' })
  @MaxLength(120)
  calle?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'El número es obligatorio' })
  @MaxLength(20)
  numero?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  piso?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'La localidad es obligatoria' })
  @MaxLength(120)
  localidad?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'La provincia es obligatoria' })
  @MaxLength(120)
  provincia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  codigoPostal?: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude({ message: 'La latitud no es válida' })
  latitud?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude({ message: 'La longitud no es válida' })
  longitud?: number;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'El identificador de Google Places es obligatorio' })
  @MaxLength(255)
  googlePlaceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  portadaUrl?: string;
}
