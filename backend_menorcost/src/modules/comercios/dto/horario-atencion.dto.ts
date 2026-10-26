import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class HorarioAtencionDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana!: number;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'La hora de inicio debe tener el formato HH:mm',
  })
  horaInicio!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'La hora de fin debe tener el formato HH:mm',
  })
  horaFin!: string;
}

export class ReemplazarHorariosDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HorarioAtencionDto)
  horarios!: HorarioAtencionDto[];
}
