import { Type } from 'class-transformer';
import { IsInt, IsUUID, Min } from 'class-validator';

export class AgregarCanastaItemDto {
  @IsUUID()
  productoId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad!: number;
}