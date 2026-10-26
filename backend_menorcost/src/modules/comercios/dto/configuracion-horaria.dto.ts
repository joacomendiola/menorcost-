import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { FranjaRetiroDto } from './franja-retiro.dto.js';
import { HorarioAtencionDto } from './horario-atencion.dto.js';

export class GuardarConfiguracionHorariaDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HorarioAtencionDto)
  horarios!: HorarioAtencionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FranjaRetiroDto)
  franjas!: FranjaRetiroDto[];
}
