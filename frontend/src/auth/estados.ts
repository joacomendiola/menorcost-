import type { EstadoUsuario } from '../api';

export function esEstadoOperativo(estado?: EstadoUsuario): boolean {
  return estado === 'HABILITADO' || estado === 'BAJO_INVESTIGACION';
}
