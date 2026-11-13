import { BadRequestException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogoService } from './catalogo.service.js';

describe('CatalogoService', () => {
  const prisma = { producto: { findMany: vi.fn() }, comercio: { findMany: vi.fn() } };
  const service = new CatalogoService(prisma as never);

  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.useRealTimers());

  it('rechaza coordenadas incompletas', async () => {
    await expect(service.listar({ latitud: -34 })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.producto.findMany).not.toHaveBeenCalled();
  });

  it('incluye relación de comercio habilitado y ordena por cercanía', async () => {
    prisma.producto.findMany.mockResolvedValue([
      { idProducto: 'cerca', comercio: { idComercio: 'c1', latitud: -34.6, longitud: -58.4 }, categoria: {} },
      { idProducto: 'lejos', comercio: { idComercio: 'c2', latitud: -35, longitud: -58 }, categoria: {} },
    ]);
    const resultado = await service.listar({ latitud: -34.6, longitud: -58.4 });
    expect(prisma.producto.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ estado: 'ACTIVO', comercio: expect.objectContaining({ estado: 'HABILITADO' }) }),
    }));
    expect(resultado[0].id).toBe('cerca');
    expect(resultado[0].distanciaKm).toBe(0);
    expect(resultado[0].comercio.latitud).toBe(-34.6);
  });

  it('incluye productos de las subcategorías al filtrar por categoría raíz', async () => {
    prisma.producto.findMany.mockResolvedValue([]);
    await service.listar({ categoriaId: 'raiz-1' });
    expect(prisma.producto.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: [{ OR: [
          { categoriaId: 'raiz-1' },
          { categoria: { is: { categoriaPadreId: 'raiz-1' } } },
        ] }],
      }),
    }));
  });

  it('calcula la fecha mínima de vigencia según el día de Argentina', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-14T02:00:00.000Z'));
    prisma.producto.findMany.mockResolvedValue([]);
    await service.listar({});
    expect(prisma.producto.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        fechaVencimiento: { gte: new Date('2026-11-13T00:00:00.000Z') },
      }),
    }));
  });
});
