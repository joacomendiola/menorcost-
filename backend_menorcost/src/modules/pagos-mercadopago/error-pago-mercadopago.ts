export type CodigoErrorPago =
  | 'mp_no_disponible'
  | 'credencial_invalida'
  | 'respuesta_invalida'
  | 'orden_no_encontrada';

/**
 * Error de dominio del pago con Mercado Pago.
 *
 * El servicio de checkout lo traduce a una excepción HTTP; así el adaptador no
 * depende de `@nestjs/common` y se puede probar sin levantar la app.
 */
export class ErrorPagoMercadoPago extends Error {
  constructor(
    readonly codigo: CodigoErrorPago,
    mensaje: string,
    readonly detalle?: string,
  ) {
    super(mensaje);
    this.name = 'ErrorPagoMercadoPago';
  }
}
