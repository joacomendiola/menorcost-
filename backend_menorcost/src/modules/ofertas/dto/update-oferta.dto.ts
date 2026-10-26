import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  Matches,
  Min,
} from 'class-validator';

export class UpdateOfferDto {
  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/)
  precioLista?: string;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/)
  precioMenorcost?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  // TODO CU 2.02: el servicio debe comprobar que el nuevo stock
  // no quede por debajo de las unidades reservadas en PENDIENTE_RETIRO.
  // El DTO solo valida formato y que el stock no sea negativo.
}
