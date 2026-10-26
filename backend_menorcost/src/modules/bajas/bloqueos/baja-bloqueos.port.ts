export interface BloqueoBaja {
  tipo: string;
  message: string;
}

/**
 * Puerto de integración con los dominios de D3/D4/D5 para la baja de cuenta
 * ([CU-1.07]).
 *
 * D1 no es dueño de `Pedido` (D4), `Reporte`/denuncias (D5) ni `Producto`
 * (D3). Este contrato permite que cada dominio conecte sus verificaciones sin
 * que D1 dependa de sus modelos:
 *  - `obtenerBloqueos`: pedidos en estado PENDIENTE_DE_RETIRO y reportes/penalizaciones abiertas.
 *  - `pausarOfertas`: pausa las ofertas activas del comercio al solicitar la baja.
 *  - `reactivarOfertas`: reactiva las ofertas si la solicitud es rechazada.
 */
export interface BajaBloqueosPort {
  obtenerBloqueos(usuarioId: string): Promise<BloqueoBaja[]>;
  pausarOfertas(usuarioId: string): Promise<void>;
  reactivarOfertas(usuarioId: string): Promise<void>;
}

export const BAJA_BLOQUEOS_PORT = Symbol('BAJA_BLOQUEOS_PORT');
