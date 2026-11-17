import { describe, expect, it } from 'vitest';
import {
  generarCodigoAlfanumerico,
  generarCodigoQR,
  generarNroPedido,
} from './codigos-pedido.js';

describe('codigos-pedido', () => {
  it('genera un codigoQR con formato UUID', () => {
    expect(generarCodigoQR()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('genera un alfanumérico de 8 caracteres sin ambigüedades', () => {
    const codigo = generarCodigoAlfanumerico();

    expect(codigo).toHaveLength(8);
    expect(codigo).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
  });

  it('genera códigos distintos entre llamadas', () => {
    const codigos = new Set(
      Array.from({ length: 50 }, () => generarCodigoAlfanumerico()),
    );

    expect(codigos.size).toBeGreaterThan(45);
  });

  it('genera el nro de pedido con la fecha argentina', () => {
    const nro = generarNroPedido(new Date('2026-11-17T18:00:00.000Z'));

    expect(nro).toMatch(/^MC-20261117-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    expect(nro.length).toBeLessThanOrEqual(30);
  });
});
