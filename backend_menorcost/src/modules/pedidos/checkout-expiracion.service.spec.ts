import { beforeEach, describe, expect, it, vi } from 'vitest';
import { liberarStockDePedido } from '../pagos-mercadopago/reserva-stock.js';
import { CheckoutExpiracionService } from './checkout-expiracion.service.js';

vi.mock('../pagos-mercadopago/reserva-stock.js', () => ({
  liberarStockDePedido: vi.fn(),
}));

describe('CheckoutExpiracionService', () => {
  const prisma = { pedido: { findMany: vi.fn() }, $transaction: vi.fn() };
  const config = { minutosGracia: vi.fn(() => 5) };
  const service = new CheckoutExpiracionService(
    prisma as never,
    config as never,
  );

  beforeEach(() => {
    vi.resetAllMocks();
    config.minutosGracia.mockReturnValue(5);
    prisma.$transaction.mockImplementation(
      (operacion: (tx: unknown) => Promise<unknown>) => operacion('tx'),
    );
    vi.mocked(liberarStockDePedido).mockResolvedValue(true);
  });

  it('cancela los pedidos vencidos con la gracia aplicada', async () => {
    prisma.pedido.findMany.mockResolvedValue([
      { id_pedido: 'pedido-1' },
      { id_pedido: 'pedido-2' },
    ]);

    await service.cancelarPedidosVencidos();

    const consulta = prisma.pedido.findMany.mock.calls[0][0];
    expect(consulta.where.estado).toBe('PENDIENTE_PAGO');
    expect(consulta.where.stockLiberadoEn).toBeNull();
    // Con 5 minutos de gracia solo entran pedidos vencidos hace más de 5.
    expect(consulta.where.fechaExpiracionPago.lt.getTime()).toBeLessThanOrEqual(
      Date.now() - 5 * 60 * 1000,
    );

    expect(liberarStockDePedido).toHaveBeenNthCalledWith(
      1,
      'tx',
      'pedido-1',
      'EXPIRADO',
    );
    expect(liberarStockDePedido).toHaveBeenNthCalledWith(
      2,
      'tx',
      'pedido-2',
      'EXPIRADO',
    );
  });

  it('no hace nada si no hay pedidos vencidos', async () => {
    prisma.pedido.findMany.mockResolvedValue([]);

    await service.cancelarPedidosVencidos();

    expect(liberarStockDePedido).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('un pedido con error no frena al resto del lote', async () => {
    prisma.pedido.findMany.mockResolvedValue([
      { id_pedido: 'pedido-1' },
      { id_pedido: 'pedido-2' },
    ]);
    prisma.$transaction
      .mockRejectedValueOnce(new Error('deadlock'))
      .mockImplementationOnce((operacion: (tx: unknown) => Promise<unknown>) =>
        operacion('tx'),
      );

    await expect(service.cancelarPedidosVencidos()).resolves.toBeUndefined();
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
});
