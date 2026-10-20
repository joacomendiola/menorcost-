import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { validateOfferRules } from './ofertas-rules.js';

describe('validateOfferRules', () => {
  const today = new Date('2026-10-19T15:00:00.000Z');

  it('acepta fecha futura y precio promocional menor al de lista', () => {
    expect(() =>
      validateOfferRules(
        {
          fechaVencimiento: '2026-10-20',
          precioLista: '100.00',
          precioMenorcost: '75.50',
        },
        today,
      ),
    ).not.toThrow();
  });

  it.each(['2026-10-19', '2026-10-18', '2026-02-30'])(
    'rechaza fecha inválida o no futura: %s',
    (fechaVencimiento) => {
      expect(() =>
        validateOfferRules(
          {
            fechaVencimiento,
            precioLista: '100.00',
            precioMenorcost: '75.00',
          },
          today,
        ),
      ).toThrow(BadRequestException);
    },
  );

  it.each([
    ['100.00', '100.00'],
    ['100.00', '110.00'],
  ])(
    'rechaza precio promocional igual o superior al original',
    (precioLista, precioMenorcost) => {
      expect(() =>
        validateOfferRules(
          {
            fechaVencimiento: '2026-10-20',
            precioLista,
            precioMenorcost,
          },
          today,
        ),
      ).toThrow(
        'El precio promocional debe ofrecer un descuento real respecto al precio de lista original',
      );
    },
  );
});