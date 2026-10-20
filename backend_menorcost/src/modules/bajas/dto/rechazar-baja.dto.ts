import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RechazarBajaDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}
