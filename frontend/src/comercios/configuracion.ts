import type { FranjaPayload, HorarioPayload } from './api';

export const DIAS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

export const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];

export const MENSAJE_FRANJA_FUERA =
  'Inconsistencia horaria: La franja de retiro seleccionada no puede establecerse durante el horario en el que el local figura cerrado. Ajuste el rango a los turnos válidos';

export function formatearRango(horario: HorarioPayload): string {
  return `${horario.horaInicio} a ${horario.horaFin}`;
}

export function validarConfiguracion(
  horarios: HorarioPayload[],
  franjas: FranjaPayload[],
): string | null {
  for (const horario of horarios) {
    if (!horario.horaInicio || !horario.horaFin) {
      return `Completá el horario del ${DIAS[horario.diaSemana] ?? 'día'}.`;
    }
    if (horario.horaFin <= horario.horaInicio) {
      return `En ${DIAS[horario.diaSemana] ?? 'el día'} la hora de fin debe ser posterior a la de inicio.`;
    }
  }

  for (const dia of ORDEN_DIAS) {
    const rangos = horarios
      .filter((horario) => horario.diaSemana === dia)
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

    for (let indice = 1; indice < rangos.length; indice += 1) {
      const anterior = rangos[indice - 1];
      const actual = rangos[indice];
      if (actual.horaInicio < anterior.horaFin) {
        return `Los horarios del ${DIAS[dia]} no pueden superponerse.`;
      }
    }
  }

  for (const franja of franjas) {
    if (!franja.horaInicio || !franja.horaFin) {
      return `Completá la franja de retiro del ${DIAS[franja.diaSemana] ?? 'día'}.`;
    }
    if (franja.horaFin <= franja.horaInicio) {
      return `En ${DIAS[franja.diaSemana] ?? 'el día'} la franja debe terminar después de empezar.`;
    }

    const contenida = horarios.some(
      (horario) =>
        horario.diaSemana === franja.diaSemana &&
        horario.horaInicio <= franja.horaInicio &&
        franja.horaFin <= horario.horaFin,
    );

    if (!contenida) {
      return MENSAJE_FRANJA_FUERA;
    }
  }

  return null;
}
