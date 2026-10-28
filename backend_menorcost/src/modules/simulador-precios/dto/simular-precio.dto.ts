import { IsOptional, Matches } from 'class-validator';

const MONTO_REGEX = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;

export class SimularPrecioDto {
  @Matches(MONTO_REGEX, {
    message: 'precioBaseNeto debe ser un monto válido con hasta 2 decimales',
  })
  precioBaseNeto!: string;

  @IsOptional()
  @Matches(MONTO_REGEX, {
    message: 'precioLista debe ser un monto válido con hasta 2 decimales',
  })
  precioLista?: string;
}
