import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaBajaBloqueosProvider } from './prisma-bloqueos.provider.js';

const prismaMock = {
  pedido: { count: vi.fn(), groupBy: vi.fn() },
  reporte: { count: vi.fn() },
  comercio: { findUnique: vi.fn(), findMany: vi.fn() },
  producto: { updateMany: vi.fn() },
};

const provider = new PrismaBajaBloqueosProvider(prismaMock as never);

describe('PrismaBajaBloqueosProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.pedido.count.mockResolvedValue(0);
    prismaMock.pedido.groupBy.mockResolvedValue([]);
    prismaMock.reporte.count.mockResolvedValue(0);
    prismaMock.comercio.findUnique.mockResolvedValue(null);
    prismaMock.comercio.findMany.mockResolvedValue([]);
    prismaMock.producto.updateMany.mockResolvedValue({ count: 0 });
  });

  describe('obtenerBloqueos', () => {
    it('no bloquea si no hay pedidos ni reportes abiertos', async () => {
      await expect(provider.obtenerBloqueos('u1')).resolves.toEqual([]);
    });

    it('bloquea por pedidos pendientes de retiro o pago, como cliente o comercio', async () => {
      prismaMock.pedido.count.mockResolvedValue(2);

      const bloqueos = await provider.obtenerBloqueos('u1');

      expect(prismaMock.pedido.count).toHaveBeenCalledWith({
        where: {
          estado: { in: ['PENDIENTE_PAGO', 'PENDIENTE_DE_RETIRO'] },
          OR: [{ usuarioId: 'u1' }, { comercio: { userId: 'u1' } }],
        },
      });
      expect(bloqueos).toHaveLength(1);
      expect(bloqueos[0].tipo).toBe('PEDIDOS');
      expect(bloqueos[0].message).toContain('2');
      expect(bloqueos[0].message).toContain('pago');
    });

    it('bloquea por reportes abiertos', async () => {
      prismaMock.reporte.count.mockResolvedValue(1);

      const bloqueos = await provider.obtenerBloqueos('u1');

      expect(bloqueos).toHaveLength(1);
      expect(bloqueos[0].tipo).toBe('REPORTES');
    });
  });

  describe('obtenerResumenesCuentas', () => {
    it('devuelve un mapa vacío sin usuarios', async () => {
      await expect(provider.obtenerResumenesCuentas([])).resolves.toEqual(
        new Map(),
      );
      expect(prismaMock.comercio.findMany).not.toHaveBeenCalled();
    });

    it('cuenta pedidos entregados como cliente', async () => {
      prismaMock.pedido.groupBy.mockResolvedValueOnce([
        { usuarioId: 'u1', _count: { _all: 2 } },
      ]);

      const resumen = await provider.obtenerResumenesCuentas(['u1']);

      expect(resumen.get('u1')).toEqual({
        pedidosCompletados: 2,
        saldoTarifas: 0,
      });
    });

    it('cuenta pedidos entregados del comercio', async () => {
      prismaMock.comercio.findMany.mockResolvedValue([
        { userId: 'u1', idComercio: 'c1' },
      ]);
      prismaMock.pedido.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ comercioId: 'c1', _count: { _all: 3 } }]);

      const resumen = await provider.obtenerResumenesCuentas(['u1']);

      expect(resumen.get('u1')).toEqual({
        pedidosCompletados: 3,
        saldoTarifas: 0,
      });
    });
  });

  describe('pausarOfertas', () => {
    it('marca solo las ofertas activas como pausadas por baja', async () => {
      prismaMock.comercio.findUnique.mockResolvedValue({ idComercio: 'c1' });

      await provider.pausarOfertas('u1');

      expect(prismaMock.producto.updateMany).toHaveBeenCalledWith({
        where: { comercioId: 'c1', estado: 'ACTIVO' },
        data: { estado: 'PAUSADO', pausadoPorBaja: true },
      });
    });

    it('no hace nada si el usuario no tiene comercio', async () => {
      await provider.pausarOfertas('u1');

      expect(prismaMock.producto.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('reactivarOfertas', () => {
    it('solo restaura las ofertas pausadas por la baja', async () => {
      prismaMock.comercio.findUnique.mockResolvedValue({ idComercio: 'c1' });

      await provider.reactivarOfertas('u1');

      expect(prismaMock.producto.updateMany).toHaveBeenCalledWith({
        where: {
          comercioId: 'c1',
          estado: 'PAUSADO',
          pausadoPorBaja: true,
        },
        data: { estado: 'ACTIVO', pausadoPorBaja: false },
      });
    });
  });
});
