const PESOS_CUIT = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export const FRANJA_FUERA_DE_HORARIO =
  'Inconsistencia horaria: La franja de retiro seleccionada no puede establecerse durante el horario en el que el local figura cerrado. Ajuste el rango a los turnos válidos';

export interface RangoHorario {
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
}

export function esCuitValido(cuit: string): boolean {
  if (!/^\d{11}$/.test(cuit)) {
    return false;
  }

  const suma = PESOS_CUIT.reduce(
    (acumulado, peso, indice) => acumulado + Number(cuit[indice]) * peso,
    0,
  );
  const resto = suma % 11;
  const digitoVerificador = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto;

  return digitoVerificador === Number(cuit[10]);
}

export function esHoraValida(hora: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
}

export function esRangoHorarioValido(horario: RangoHorario): boolean {
  return (
    esHoraValida(horario.horaInicio) &&
    esHoraValida(horario.horaFin) &&
    horario.horaInicio < horario.horaFin
  );
}

export function estaFranjaContenida(
  franja: RangoHorario,
  horarios: RangoHorario[],
): boolean {
  return horarios.some(
    (horario) =>
      horario.diaSemana === franja.diaSemana &&
      horario.horaInicio <= franja.horaInicio &&
      franja.horaFin <= horario.horaFin,
  );
}

export function haySolapamientoDeHorarios(horarios: RangoHorario[]): boolean {
  const porDia = new Map<number, RangoHorario[]>();

  for (const horario of horarios) {
    const delDia = porDia.get(horario.diaSemana) ?? [];
    delDia.push(horario);
    porDia.set(horario.diaSemana, delDia);
  }

  for (const delDia of porDia.values()) {
    const ordenados = [...delDia].sort((a, b) =>
      a.horaInicio.localeCompare(b.horaInicio),
    );

    for (let indice = 1; indice < ordenados.length; indice += 1) {
      if (ordenados[indice].horaInicio < ordenados[indice - 1].horaFin) {
        return true;
      }
    }
  }

  return false;
}
