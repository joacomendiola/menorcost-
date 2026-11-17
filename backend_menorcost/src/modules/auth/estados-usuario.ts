export const ESTADOS_USUARIO_OPERATIVOS = [
  'HABILITADO',
  'BAJO_INVESTIGACION',
] as const;

export function esEstadoUsuarioOperativo(estado: string): boolean {
  return (ESTADOS_USUARIO_OPERATIVOS as readonly string[]).includes(estado);
}
