export type MotivoOauth =
  | 'cancelado'
  | 'state_invalido'
  | 'codigo_invalido'
  | 'mp_no_disponible'
  | 'cuenta_mp_en_uso'
  | 'ya_vinculado'
  | 'comercio_no_habilitado'
  | 'usuario_no_habilitado'
  | 'sin_comercio'
  | 'error_interno';

/** Error de negocio del flujo OAuth, con un motivo que el frontend sabe mostrar. */
export class MercadoPagoOauthError extends Error {
  constructor(
    readonly motivo: MotivoOauth,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'MercadoPagoOauthError';
  }
}
