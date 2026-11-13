import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class ActualizarCanastaItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad!: number;
}