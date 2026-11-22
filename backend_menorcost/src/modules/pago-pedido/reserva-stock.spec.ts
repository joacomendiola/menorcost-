import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { liberarStockDePedido, reservarStock } from './reserva-stock.js';

describe('reserva-stock', () => {
  const tx = {
    producto: { updateMany: vi.fn() },
    pedido: { updateMany: vi.fn() },
    pedidoItem: { findMany: vi.fn() },
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('reservarStock', () => {
    it('descuenta de forma condicional: solo si hay stock suficiente', async () => {
      tx.producto.updateMany.mockResolvedValue({ count: 1 });

      await reservarStock(tx as never, [{ productoId: 'prod-1', cantidad: 2 }]);

      expect(tx.producto.updateMany).toHaveBeenCalledWith({
        where: { idProducto: 'prod-1', estado: 'ACTIVO', stock: { gte: 2 } },
        data: { stock: { decrement: 2 } },
      });
    });

    it('si otro checkout ganó la última unidad lanza Conflict', async () => {
      tx.producto.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        reservarStock(tx as never, [{ productoId: 'prod-1', cantidad: 2 }]),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('liberarStockDePedido', () => {
    it('cancela el pedido y devuelve el stock', async () => {
      tx.pedidoItem.findMany.mockResolvedValue([
        { productoId: 'prod-1', cantidad: 2 },
      ]);
      tx.pedido.updateMany.mockResolvedValue({ count: 1 });
      tx.producto.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        liberarStockDePedido(tx as never, 'pedido-1', 'EXPIRADO'),
      ).resolves.toBe(true);

      const actualizacion = tx.pedido.updateMany.mock.calls[0][0];
      expect(actualizacion.where).toEqual({
        id_pedido: 'pedido-1',
        estado: 'PENDIENTE_PAGO',
        stockLiberadoEn: null,
      });
      expect(actualizacion.data.estado).toBe('CANCELADO');
      expect(actualizacion.data.motivoCancelacion).toBe('EXPIRADO');
      expect(actualizacion.data.stockLiberadoEn).toBeInstanceOf(Date);

      expect(tx.producto.updateMany).toHaveBeenCalledWith({
        where: { idProducto: 'prod-1' },
        data: { stock: { increment: 2 } },
      });
    });

    it('es idempotente: si ya se liberó no vuelve a sumar stock', async () => {
      tx.pedidoItem.findMany.mockResolvedValue([
        { productoId: 'prod-1', cantidad: 2 },
      ]);
      tx.pedido.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        liberarStockDePedido(tx as never, 'pedido-1', 'EXPIRADO'),
      ).resolves.toBe(false);
      expect(tx.producto.updateMany).not.toHaveBeenCalled();
    });
  });
});
