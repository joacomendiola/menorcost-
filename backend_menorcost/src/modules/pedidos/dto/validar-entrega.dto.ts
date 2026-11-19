import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Código que el comerciante escanea o tipea en el mostrador.
 * Acepta el UUID del QR o el código alfanumérico del ticket.
 */
export class ValidarEntregaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  codigo!: string;
}
