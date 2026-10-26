import { describe, expect, it } from 'vitest';
import {
  esCuitValido,
  esHoraValida,
  esRangoHorarioValido,
  estaFranjaContenida,
  haySolapamientoDeHorarios,
} from './comercios-rules.js';

describe('esCuitValido', () => {
  it('acepta un CUIT con dígito verificador correcto', () => {
    expect(esCuitValido('20123456786')).toBe(true);
  });

  it('rechaza un CUIT con dígito verificador incorrecto', () => {
    expect(esCuitValido('20123456780')).toBe(false);
  });

  it('rechaza un CUIT con formato inválido', () => {
    expect(esCuitValido('20-12345678-6')).toBe(false);
    expect(esCuitValido('2012345678')).toBe(false);
  });
});

describe('esHoraValida', () => {
  it('acepta horas del día en formato HH:mm', () => {
    expect(esHoraValida('00:00')).toBe(true);
    expect(esHoraValida('09:30')).toBe(true);
    expect(esHoraValida('23:59')).toBe(true);
  });

  it('rechaza formatos o valores fuera de rango', () => {
    expect(esHoraValida('9:30')).toBe(false);
    expect(esHoraValida('24:00')).toBe(false);
    expect(esHoraValida('12:60')).toBe(false);
  });
});

describe('esRangoHorarioValido', () => {
  it('exige que el fin sea posterior al inicio', () => {
    expect(
      esRangoHorarioValido({
        diaSemana: 1,
        horaInicio: '09:00',
        horaFin: '18:00',
      }),
    ).toBe(true);

    expect(
      esRangoHorarioValido({
        diaSemana: 1,
        horaInicio: '18:00',
        horaFin: '09:00',
      }),
    ).toBe(false);

    expect(
      esRangoHorarioValido({
        diaSemana: 1,
        horaInicio: '09:00',
        horaFin: '09:00',
      }),
    ).toBe(false);
  });
});

describe('estaFranjaContenida', () => {
  const horarios = [
    { diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' },
    { diaSemana: 1, horaInicio: '14:00', horaFin: '18:00' },
  ];

  it('acepta franjas dentro de un horario del mismo día', () => {
    expect(
      estaFranjaContenida(
        { diaSemana: 1, horaInicio: '10:00', horaFin: '12:00' },
        horarios,
      ),
    ).toBe(true);

    expect(
      estaFranjaContenida(
        { diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' },
        horarios,
      ),
    ).toBe(true);
  });

  it('rechaza franjas fuera del horario o de otro día', () => {
    expect(
      estaFranjaContenida(
        { diaSemana: 1, horaInicio: '12:00', horaFin: '14:30' },
        horarios,
      ),
    ).toBe(false);

    expect(
      estaFranjaContenida(
        { diaSemana: 2, horaInicio: '10:00', horaFin: '12:00' },
        horarios,
      ),
    ).toBe(false);
  });
});

describe('haySolapamientoDeHorarios', () => {
  it('detecta rangos superpuestos en el mismo día', () => {
    expect(
      haySolapamientoDeHorarios([
        { diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' },
        { diaSemana: 1, horaInicio: '12:00', horaFin: '18:00' },
      ]),
    ).toBe(true);
  });

  it('permite rangos contiguos o de días distintos', () => {
    expect(
      haySolapamientoDeHorarios([
        { diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' },
        { diaSemana: 1, horaInicio: '13:00', horaFin: '18:00' },
        { diaSemana: 2, horaInicio: '09:00', horaFin: '18:00' },
      ]),
    ).toBe(false);
  });
});
