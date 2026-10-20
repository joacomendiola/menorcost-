import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CodigosService } from './codigos.service.js';

const prismaMock = {
  codigoSeguridad: {
    updateMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
};

const service = new CodigosService(prismaMock as never);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CodigosService', () => {
  it('genera códigos numéricos de 6 dígitos', () => {
    for (let i = 0; i < 50; i++) {
      expect(service.generarCodigoNumerico()).toMatch(/^\d{6}$/);
    }
  });

  it('genera tokens aleatorios de 64 caracteres hex', () => {
    const token = service.generarToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(service.generarToken()).not.toBe(token);
  });

  it('hashea de forma determinista con sha256', () => {
    expect(service.hash('abc')).toBe(
      createHash('sha256').update('abc').digest('hex'),
    );
  });

  it('crear invalida los códigos anteriores del mismo tipo', async () => {
    prismaMock.codigoSeguridad.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.codigoSeguridad.create.mockResolvedValue({ id: 'c1' });

    await service.crear('u1', 'VERIFICACION_EMAIL', '123456', 10);

    expect(prismaMock.codigoSeguridad.updateMany).toHaveBeenCalledWith({
      where: { usuarioId: 'u1', tipo: 'VERIFICACION_EMAIL', usadoEn: null },
      data: { usadoEn: expect.any(Date) },
    });
    expect(prismaMock.codigoSeguridad.create).toHaveBeenCalledWith({
      data: {
        usuarioId: 'u1',
        tipo: 'VERIFICACION_EMAIL',
        codigoHash: service.hash('123456'),
        expiraEn: expect.any(Date),
      },
    });
  });

  it('validarPorUsuario devuelve null cuando el código no coincide', async () => {
    prismaMock.codigoSeguridad.findFirst.mockResolvedValue({
      id: 'c1',
      codigoHash: service.hash('999999'),
    });

    await expect(
      service.validarPorUsuario('u1', 'VERIFICACION_EMAIL', '123456'),
    ).resolves.toBeNull();
  });

  it('validarPorUsuario devuelve el registro cuando coincide', async () => {
    const registro = { id: 'c1', codigoHash: service.hash('123456') };
    prismaMock.codigoSeguridad.findFirst.mockResolvedValue(registro);

    await expect(
      service.validarPorUsuario('u1', 'VERIFICACION_EMAIL', '123456'),
    ).resolves.toBe(registro);
  });

  it('buscarPorToken consulta por hash y vigencia', async () => {
    prismaMock.codigoSeguridad.findFirst.mockResolvedValue(null);

    await service.buscarPorToken('RECUPERACION_PASSWORD', 'tok');

    expect(prismaMock.codigoSeguridad.findFirst).toHaveBeenCalledWith({
      where: {
        tipo: 'RECUPERACION_PASSWORD',
        codigoHash: service.hash('tok'),
        usadoEn: null,
        expiraEn: { gt: expect.any(Date) },
      },
    });
  });

  it('consumir marca el código como usado', async () => {
    prismaMock.codigoSeguridad.update.mockResolvedValue({});

    await service.consumir('c1');

    expect(prismaMock.codigoSeguridad.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { usadoEn: expect.any(Date) },
    });
  });
});
