import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

const booleano = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

export class BuscarCatalogoDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsUUID() categoriaId?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitud?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitud?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(200) radioKm?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) precioMin?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) precioMax?: number;
  @IsOptional() @Transform(booleano) @IsBoolean() abierto?: boolean;
  @IsOptional() @Transform(booleano) @IsBoolean() soloConStock?: boolean;
}

export class BuscarComerciosDto {
  @IsString() q!: string;
}
