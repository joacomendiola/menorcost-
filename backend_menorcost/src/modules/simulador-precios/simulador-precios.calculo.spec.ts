import { describe, expect, it } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import {
  calcularPrecios,
  PrecioInvalidoError,
} from './simulador-precios.calculo.js';

describe('calcularPrecios', () => {
  it('calcula el precio público con comisión de Menorcost y Mercado Pago', () => {
    const resultado = calcularPrecios({
      precioBaseNeto: '2000.00',
      comisionMenorcostTasa: '0.1000',
      tasaMpEstimada: '0.0650',
      precioLista: '2400.00',
    });

    expect(resultado.comisionMenorcostMonto).toBe('200.00');
    expect(resultado.precioPublico).toBe('2352.95');
    expect(resultado.comisionMpEstimada).toBe('152.95');
    expect(resultado.netoEstimadoComerciante).toBe('2000.00');
    expect(resultado.ahorroPorcentaje).toBe('1.96');
  });

  it('redondea hacia arriba en cada paso del gross-up', () => {
    const resultado = calcularPrecios({
      precioBaseNeto: '1000.00',
      comisionMenorcostTasa: '0.1000',
      tasaMpEstimada: '0.0650',
    });

    expect(resultado.comisionMenorcostMonto).toBe('100.00');
    expect(resultado.precioPublico).toBe('1176.48');
    expect(resultado.comisionMpEstimada).toBe('76.48');
    expect(resultado.netoEstimadoComerciante).toBe('1000.00');
  });

  it('mantiene precisión con montos de centavos', () => {
    const resultado = calcularPrecios({
      precioBaseNeto: '0.01',
      comisionMenorcostTasa: '0.1000',
      tasaMpEstimada: '0.0650',
    });

    expect(resultado.comisionMenorcostMonto).toBe('0.01');
    expect(resultado.precioPublico).toBe('0.03');
    expect(resultado.comisionMpEstimada).toBe('0.01');
    expect(resultado.netoEstimadoComerciante).toBe('0.01');
  });

  it('nunca deja un neto inferior al precio base neto en montos extremos', () => {
    const casos = [
      { precioBaseNeto: '9999999.99', comisionMenorcostTasa: '0.1000' },
      { precioBaseNeto: '1234567.89', comisionMenorcostTasa: '0.3333' },
      { precioBaseNeto: '0.05', comisionMenorcostTasa: '0.1000' },
      { precioBaseNeto: '9999999999.99', comisionMenorcostTasa: '0.5000' },
    ];

    for (const caso of casos) {
      const resultado = calcularPrecios({
        ...caso,
        tasaMpEstimada: '0.0650',
      });

      const base = new Prisma.Decimal(resultado.precioBaseNeto);
      const neto = new Prisma.Decimal(resultado.netoEstimadoComerciante);
      const publico = new Prisma.Decimal(resultado.precioPublico);
      const comision = new Prisma.Decimal(resultado.comisionMenorcostMonto);
      const comisionMp = new Prisma.Decimal(resultado.comisionMpEstimada);

      expect(neto.gte(base)).toBe(true);
      expect(publico.minus(comision).minus(comisionMp).eq(neto)).toBe(true);
    }
  });

  it('rechaza un precio base neto inválido', () => {
    expect(() =>
      calcularPrecios({
        precioBaseNeto: '0',
        comisionMenorcostTasa: '0.1000',
        tasaMpEstimada: '0.0650',
      }),
    ).toThrow(PrecioInvalidoError);
  });

  it('rechaza tasas fuera del rango permitido', () => {
    expect(() =>
      calcularPrecios({
        precioBaseNeto: '100.00',
        comisionMenorcostTasa: '1',
        tasaMpEstimada: '0.0650',
      }),
    ).toThrow(PrecioInvalidoError);

    expect(() =>
      calcularPrecios({
        precioBaseNeto: '100.00',
        comisionMenorcostTasa: '0.1000',
        tasaMpEstimada: '1',
      }),
    ).toThrow(PrecioInvalidoError);
  });

  it('rechaza un precio de lista no positivo', () => {
    expect(() =>
      calcularPrecios({
        precioBaseNeto: '100.00',
        comisionMenorcostTasa: '0.1000',
        tasaMpEstimada: '0.0650',
        precioLista: '0',
      }),
    ).toThrow(PrecioInvalidoError);
  });
});
