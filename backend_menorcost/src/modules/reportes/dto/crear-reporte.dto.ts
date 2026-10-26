import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { TipoDestinoReporte } from '../../../generated/prisma/enums.js';

export class CrearReporteDto {
  @IsNotEmpty()
  @IsUUID()
  idPedido: string;

  @IsNotEmpty()
  @IsString()
  motivo: string; // Categoría seleccionada en el select

  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcion?: string; // Máximo 300 caracteres según CU-5.02

  @IsNotEmpty()
  @IsEnum(TipoDestinoReporte)
  tipo_destino: TipoDestinoReporte; // COMERCIO o CLIENTE
}