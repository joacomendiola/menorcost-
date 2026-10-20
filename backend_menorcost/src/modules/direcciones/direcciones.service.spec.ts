import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DireccionesService } from './direcciones.service.js';

const txMock = {
  direccion: { count: vi.fn(), create: vi.fn() },
};
const prismaMock = {
  direccion: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

const service = new DireccionesService(prismaMock as never);

const direccionBase = {
  id: 'd1',
  usuarioId: 'u1',
  esPredeterminada: false,
  deletedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: unknown) => unknown)(txMock)
      : Promise.all(arg as Promise<unknown>[]),
  );
});

describe('DireccionesService.listar', () => {
  it('filtra por dueño y excluye borradas', async () => {
    prismaMock.direccion.findMany.mockResolvedValue([]);

    await service.listar('u1');

    expect(prismaMock.direccion.findMany).toHaveBeenCalledWith({
      where: { usuarioId: 'u1', deletedAt: null },
      orderBy: [{ esPredeterminada: 'desc' }, { createdAt: 'asc' }],
    });
  });
});

describe('DireccionesService.crear', () => {
  it('la primera dirección nace como predeterminada', async () => {
    txMock.direccion.count.mockResolvedValue(0);
    txMock.direccion.create.mockResolvedValue({ id: 'd1', esPredeterminada: true });

    await service.crear('u1', {
      etiqueta: 'Casa',
      calle: 'San Martin',
      numero: '123',
      localidad: 'Ushuaia',
      latitud: -54.8,
      longitud: -68.3,
    });

    expect(txMock.direccion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ esPredeterminada: true, usuarioId: 'u1' }),
    });
  });

  it('las direcciones siguientes son secundarias', async () => {
    txMock.direccion.count.mockResolvedValue(2);
    txMock.direccion.create.mockResolvedValue({ id: 'd2', esPredeterminada: false });

    await service.crear('u1', {
      etiqueta: 'Trabajo',
      calle: 'Paz',
      numero: '5',
      localidad: 'Ushuaia',
      latitud: -54.81,
      longitud: -68.31,
    });

    expect(txMock.direccion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ esPredeterminada: false }),
    });
  });
});

describe('DireccionesService.actualizar', () => {
  it('rechaza direcciones de otro usuario', async () => {
    prismaMock.direccion.findFirst.mockResolvedValue(null);

    await expect(
      service.actualizar('u1', 'ajena', { etiqueta: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('actualiza una dirección propia', async () => {
    prismaMock.direccion.findFirst.mockResolvedValue(direccionBase);
    prismaMock.direccion.update.mockResolvedValue({
      ...direccionBase,
      etiqueta: 'Oficina',
    });

    const resultado = await service.actualizar('u1', 'd1', {
      etiqueta: 'Oficina',
    });

    expect(resultado.etiqueta).toBe('Oficina');
  });
});

describe('DireccionesService.eliminar', () => {
  it('no permite eliminar la predeterminada', async () => {
    prismaMock.direccion.findFirst.mockResolvedValue({
      ...direccionBase,
      esPredeterminada: true,
    });

    await expect(service.eliminar('u1', 'd1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prismaMock.direccion.update).not.toHaveBeenCalled();
  });

  it('hace soft delete de una secundaria', async () => {
    prismaMock.direccion.findFirst.mockResolvedValue(direccionBase);
    prismaMock.direccion.update.mockResolvedValue({});

    await service.eliminar('u1', 'd1');

    expect(prismaMock.direccion.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: { deletedAt: expect.any(Date) },
    });
  });
});

describe('DireccionesService.marcarPredeterminada', () => {
  it('desmarca las demás y marca la elegida', async () => {
    prismaMock.direccion.findFirst.mockResolvedValue(direccionBase);
    prismaMock.direccion.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.direccion.update.mockResolvedValue({
      ...direccionBase,
      esPredeterminada: true,
    });

    const resultado = await service.marcarPredeterminada('u1', 'd1');

    expect(prismaMock.direccion.updateMany).toHaveBeenCalledWith({
      where: { usuarioId: 'u1', deletedAt: null, esPredeterminada: true },
      data: { esPredeterminada: false },
    });
    expect(resultado.esPredeterminada).toBe(true);
  });
});
