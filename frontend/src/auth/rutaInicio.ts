import type { EstadoUsuario, Rol } from '../api';
import { esEstadoOperativo } from './estados';

/** Pantalla de entrada tras iniciar sesión, según el rol y estado (CU-1.03). */
export function rutaInicio(rol: Rol, estado?: EstadoUsuario): string {
  if (rol === 'ADMINISTRADOR') return '/admin/altas';

  if (rol === 'COMERCIANTE') {
    return esEstadoOperativo(estado) ? '/panel' : '/comercio/estado';
  }

  return '/inicio';
}
