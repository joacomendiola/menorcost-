import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogoService } from './catalogo.service.js';

describe('CatalogoService', () => {
  const prisma = { producto: { findMany: vi.fn() }, comercio: { findMany: vi.fn() } };
  const service = new CatalogoService(prisma as never);

  beforeEach(() => vi.clearAllMocks());

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
  });
});
