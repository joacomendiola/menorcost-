import { ApiError } from '../../api';

/** Filtro de denuncias del lado del cliente: PENDIENTE_REVISION + BAJO_INVESTIGACION. */
export const ESTADO_ABIERTAS = 'ABIERTAS';

export function iniciales(nombre: string, apellido = ''): string {
  const a = nombre.trim().charAt(0);
  const b = apellido.trim().charAt(0) || nombre.trim().charAt(1);
  return `${a}${b}`.toUpperCase();
}

export function formatFechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

export function formatFechaLarga(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatPesos(valor: string | number | null | undefined): string {
  const n = Number(valor ?? 0);
  if (!Number.isFinite(n)) return '$0';
  return `$${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
}

export function nombreCompleto(u: { nombre: string; apellido: string }): string {
  return `${u.nombre} ${u.apellido}`.trim();
}

/** Mensaje legible para mostrar en un toast ante un error de la API. */
export function mensajeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.bloqueos?.length) {
      return `${err.message} ${err.bloqueos.map((b) => b.message).join(' ')}`.trim();
    }
    return err.message;
  }
  return 'Ocurrió un error inesperado. Intentá de nuevo.';
}

export function esSesionVencida(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}