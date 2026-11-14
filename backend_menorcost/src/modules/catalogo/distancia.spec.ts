import { describe, expect, it } from 'vitest';
import { calcularDistanciaKm } from './distancia.js';

describe('calcularDistanciaKm', () => {
  it('devuelve cero para el mismo punto', () => {
    expect(calcularDistanciaKm(-34.6, -58.4, -34.6, -58.4)).toBe(0);
  });

  it('calcula distancia en kilómetros entre Buenos Aires y La Plata', () => {
    expect(calcularDistanciaKm(-34.6037, -58.3816, -34.9214, -57.9544)).toBeCloseTo(52.4, 0);
  });
});
