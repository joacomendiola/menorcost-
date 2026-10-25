import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class FranjaRetiroDto {
  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana!: number;

  @IsString()
  @Matches(HORA_REGEX, {
    message: 'La hora de inicio debe tener formato HH:mm',
  })
  horaInicio!: string;

  @IsString()
  @Matches(HORA_REGEX, {
    message: 'La hora de fin debe tener formato HH:mm',
  })
  horaFin!: string;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}

export class ReemplazarFranjasDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FranjaRetiroDto)
  franjas!: FranjaRetiroDto[];
}
