import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ActualizarDireccionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  etiqueta?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  calle?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  numero?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  piso?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  localidad?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude({ message: 'La latitud no es válida' })
  latitud?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude({ message: 'La longitud no es válida' })
  longitud?: number;
}
