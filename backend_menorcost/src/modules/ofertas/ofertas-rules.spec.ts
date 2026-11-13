import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { validateOfferRules, validatePublicPrice } from './ofertas-rules.js';

describe('validateOfferRules', () => {
  const today = new Date('2026-10-19T15:00:00.000Z');

  it('acepta fecha futura y precio base neto positivo', () => {
    expect(() =>
      validateOfferRules(
        {
          fechaVencimiento: '2026-10-20',
          precioLista: '100.00',
          precioBaseNeto: '75.50',
        },
        today,
      ),
    ).not.toThrow();
  });

  it.each([
    '2026-10-19',
    '2026-10-18',
    '2026-02-30',
  ])(
    'rechaza fecha inválida o no futura: %s',
    (fechaVencimiento) => {
      expect(() =>
        validateOfferRules(
          {
            fechaVencimiento,
            precioLista: '100.00',
            precioBaseNeto: '75.00',
          },
          today,
        ),
      ).toThrow(BadRequestException);
    },
  );

  it('rechaza un precio de lista igual a cero', () => {
    expect(() =>
      validateOfferRules(
        {
          fechaVencimiento: '2026-10-20',
          precioLista: '0.00',
          precioBaseNeto: '75.00',
        },
        today,
      ),
    ).toThrow('Los precios deben ser mayores que cero');
  });

  it('rechaza un precio base neto igual a cero', () => {
    expect(() =>
      validateOfferRules(
        {
          fechaVencimiento: '2026-10-20',
          precioLista: '100.00',
          precioBaseNeto: '0.00',
        },
        today,
      ),
    ).toThrow('Los precios deben ser mayores que cero');
  });
    describe('validatePublicPrice', () => {
    it('acepta precios con uno y dos decimales cuando el público es menor', () => {
      expect(() => validatePublicPrice('100', '75.5')).not.toThrow();
      expect(() => validatePublicPrice('100.00', '75.50')).not.toThrow();
    });
  
    it('rechaza cuando el precio público es igual al precio de lista', () => {
      expect(() => validatePublicPrice('100.00', '100.00')).toThrow(
        'El precio público debe ser menor que el precio de lista',
      );
    });
  
    it('rechaza cuando el precio público supera el precio de lista', () => {
      expect(() => validatePublicPrice('100.00', '100.01')).toThrow(
        'El precio público debe ser menor que el precio de lista',
      );
    });
  
    it.each([
      ['100.000', '75.00'],
      ['100.00', '75.000'],
      ['100,00', '75.00'],
      ['100.00', '75,00'],
      ['abc', '75.00'],
      ['100.00', 'abc'],
    ])(
      'rechaza formatos inválidos: lista=%s, público=%s',
      (precioLista, precioPublico) => {
        expect(() =>
          validatePublicPrice(precioLista, precioPublico),
        ).toThrow('El formato de precio no es válido');
      },
    );
  
    it('rechaza precios iguales a cero', () => {
      expect(() => validatePublicPrice('0.00', '0.00')).toThrow(
        'Los precios deben ser mayores que cero',
      );
    });
  });
  describe('validatePublicPrice', () => {
    it('acepta precios con uno y dos decimales cuando el público es menor', () => {
      expect(() => validatePublicPrice('100', '75.5')).not.toThrow();
      expect(() => validatePublicPrice('100.00', '75.50')).not.toThrow();
    });
  
    it('rechaza cuando el precio público es igual al precio de lista', () => {
      expect(() => validatePublicPrice('100.00', '100.00')).toThrow(
        'El precio público debe ser menor que el precio de lista',
      );
    });
  
    it('rechaza cuando el precio público supera el precio de lista', () => {
      expect(() => validatePublicPrice('100.00', '100.01')).toThrow(
        'El precio público debe ser menor que el precio de lista',
      );
    });
  
    it.each([
      ['100.000', '75.00'],
      ['100.00', '75.000'],
      ['100,00', '75.00'],
      ['100.00', '75,00'],
      ['abc', '75.00'],
      ['100.00', 'abc'],
    ])(
      'rechaza formatos inválidos: lista=%s, público=%s',
      (precioLista, precioPublico) => {
        expect(() =>
          validatePublicPrice(precioLista, precioPublico),
        ).toThrow('El formato de precio no es válido');
      },
    );
  
    it('rechaza precios iguales a cero', () => {
      expect(() => validatePublicPrice('0.00', '0.00')).toThrow(
        'Los precios deben ser mayores que cero',
      );
    });
  });
});