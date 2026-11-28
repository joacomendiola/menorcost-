import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import {
  MotivoReporte,
  TipoDestinoReporte,
} from '../../../generated/prisma/enums.js';

export class CrearReporteDto {
  @IsNotEmpty()
  @IsUUID()
  idPedido: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  motivo?: string; // Texto legacy; el frontend nuevo envía motivoCodigo.

  @IsOptional()
  @IsEnum(MotivoReporte)
  motivoCodigo?: MotivoReporte;

  @IsNotEmpty()
  @IsString()
  @MaxLength(300)
  descripcion: string; // Justificación obligatoria según CU-5.02, máximo 300 caracteres

  @IsNotEmpty()
  @IsEnum(TipoDestinoReporte)
  tipo_destino: TipoDestinoReporte; // COMERCIO o CLIENTE
}