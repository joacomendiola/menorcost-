import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CrearDireccionDto {
  @IsString()
  @MinLength(1, { message: 'La etiqueta es obligatoria' })
  @MaxLength(60)
  etiqueta!: string;

  @IsString()
  @MinLength(1, { message: 'La calle es obligatoria' })
  @MaxLength(120)
  calle!: string;

  @IsString()
  @MinLength(1, { message: 'El número es obligatorio' })
  @MaxLength(10)
  numero!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  piso?: string;

  @IsString()
  @MinLength(1, { message: 'La localidad es obligatoria' })
  @MaxLength(120)
  localidad!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;

  @Type(() => Number)
  @IsLatitude({ message: 'La latitud no es válida' })
  latitud!: number;

  @Type(() => Number)
  @IsLongitude({ message: 'La longitud no es válida' })
  longitud!: number;
}
