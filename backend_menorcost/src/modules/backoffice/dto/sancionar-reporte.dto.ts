import { IsIn, IsOptional } from 'class-validator';

export type AlcanceSancion = 'CUENTA' | 'PUBLICACION';

export class SancionarReporteDto {
  @IsOptional()
  @IsIn(['CUENTA', 'PUBLICACION'], {
    message: 'El alcance debe ser CUENTA o PUBLICACION',
  })
  alcance?: AlcanceSancion;
}
