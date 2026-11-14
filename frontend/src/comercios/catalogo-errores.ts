import { ApiError } from '../api';

export const MENSAJE_ERROR_CONEXION =
  'Error de conexión: No se pudo actualizar el catálogo por cercanía. Comprueba tu conexión a Internet e inténtalo nuevamente';

export function obtenerMensajeErrorCatalogo(error: unknown): string {
  if (error instanceof ApiError && error.status > 0) {
    return error.message;
  }
  return MENSAJE_ERROR_CONEXION;
}
