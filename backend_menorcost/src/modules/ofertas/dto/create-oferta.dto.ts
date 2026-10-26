import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateOfferDto {
  @IsIn(['INDIVIDUAL', 'COMBO'])
  tipo!: 'INDIVIDUAL' | 'COMBO';

  @IsUUID()
  comercioId!: string;

  @IsUUID()
  categoriaId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  titulo!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  descripcion!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fechaVencimiento!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  stock!: number;

  @Matches(/^\d+(\.\d{1,2})?$/)
  precioLista!: string;

  @Matches(/^\d+(\.\d{1,2})?$/)
  precioMenorcost!: string;
}