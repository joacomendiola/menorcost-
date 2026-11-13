import { describe, expect, it } from 'vitest';
import { crearUrlTilesCarto } from './mapaTiles';

describe('crearUrlTilesCarto', () => {
  it('agrega la clave CARTO codificada en la URL de tiles', () => {
    expect(crearUrlTilesCarto('mi clave/+')).toBe(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=mi%20clave%2F%2B',
    );
  });

  it('omite el parámetro si no se configuró una clave', () => {
    expect(crearUrlTilesCarto('  ')).toBe(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    );
  });
});
