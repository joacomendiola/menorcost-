import type { Rol } from '../api';

/** Pantalla de entrada tras iniciar sesión, según el rol (CU-1.03, ext. 6c). */
export function rutaInicio(rol: Rol): string {
  return rol === 'ADMINISTRADOR' ? '/admin/altas' : '/perfil';
}