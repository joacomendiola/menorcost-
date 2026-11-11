import type { EstadoUsuario, Rol } from '../api';

/** Pantalla de entrada tras iniciar sesión, según el rol y estado (CU-1.03). */
export function rutaInicio(rol: Rol, estado?: EstadoUsuario): string {
  if (rol === 'ADMINISTRADOR') return '/admin/altas';

  if (rol === 'COMERCIANTE') {
    return estado === 'HABILITADO' ? '/panel' : '/comercio/estado';
  }

  return '/perfil';
}
