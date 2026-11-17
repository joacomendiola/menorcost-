/**
 * Helpers de fecha/hora para la zona horaria argentina.
 *
 * `FranjaRetiro.diaSemana` usa la convención de JavaScript:
 * 0 = domingo ... 6 = sábado (igual que `Date#getDay()` y que el frontend).
 */

const ZONA_ARGENTINA = 'America/Argentina/Ushuaia';

const DIA_SEMANA_POR_ABREVIATURA: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function parte(
  partes: Intl.DateTimeFormatPart[],
  tipo: Intl.DateTimeFormatPartTypes,
): string {
  return partes.find((elemento) => elemento.type === tipo)?.value ?? '';
}

/** Fecha del calendario argentino en formato `YYYY-MM-DD`. */
export function fechaArgentinaISO(ahora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_ARGENTINA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ahora);

  return [
    parte(partes, 'year'),
    parte(partes, 'month'),
    parte(partes, 'day'),
  ].join('-');
}

/** Hora del calendario argentino en formato `HH:mm`. */
export function horaArgentinaHHMM(ahora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONA_ARGENTINA,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(ahora);

  return [parte(partes, 'hour'), parte(partes, 'minute')].join(':');
}

/** Día de la semana argentino: 0 = domingo ... 6 = sábado. */
export function diaSemanaArgentina(ahora: Date = new Date()): number {
  const abreviatura = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_ARGENTINA,
    weekday: 'short',
  }).format(ahora);

  return DIA_SEMANA_POR_ABREVIATURA[abreviatura] ?? 0;
}

/** Suma días a una fecha `YYYY-MM-DD` sin depender del huso local. */
export function sumarDiasISO(fechaISO: string, dias: number): string {
  const fecha = new Date(`${fechaISO}T00:00:00.000Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);

  return fecha.toISOString().slice(0, 10);
}

/**
 * Convierte una fecha `YYYY-MM-DD` al `Date` de medianoche UTC que Prisma
 * espera para las columnas `@db.Date`.
 */
export function fechaISOaDate(fechaISO: string): Date {
  return new Date(`${fechaISO}T00:00:00.000Z`);
}

const ABREVIATURA_DIA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/**
 * Etiqueta legible para el selector de franjas: `Lun 17/11 · 10:00 a 11:00`.
 *
 * Se arma a mano (en vez de `Intl` con `es-AR`) para que el formato no dependa
 * de la versión de ICU del runtime: `es-AR` devuelve `17-11` en algunos Node.
 */
export function etiquetaRetiro(
  fechaISO: string,
  horaInicio: string,
  horaFin: string,
): string {
  const fecha = fechaISOaDate(fechaISO);
  const dia = ABREVIATURA_DIA[fecha.getUTCDay()];
  const diaMes = `${String(fecha.getUTCDate()).padStart(2, '0')}/${String(
    fecha.getUTCMonth() + 1,
  ).padStart(2, '0')}`;

  return `${dia} ${diaMes} · ${horaInicio} a ${horaFin}`;
}
