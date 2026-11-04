import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OffersExpirationService } from './ofertas-expiration.service.js';

describe('OffersExpirationService', () => {
  let service: OffersExpirationService;
  let prisma: {
    producto: {
      findMany: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  const now = new Date('2026-11-03T13:00:00.000-03:00');

  const expiredOffer = {
    idProducto: '11111111-1111-4111-8111-111111111111',
    comercioId: '22222222-2222-4222-8222-222222222222',
    titulo: 'Canasta de verduras',
    fechaVencimiento: new Date('2026-11-02T00:00:00.000Z'),
    comercio: {
      userId: '33333333-3333-4333-8333-333333333333',
    },
  };

  beforeEach(() => {
    prisma = {
      producto: {
        findMany: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    service = new OffersExpirationService(prisma as never);
  });

  it('procesa ofertas activas vencidas y crea auditoría y notificación', async () => {
    const transaction = {
      producto: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditoriaVencimientoOferta: {
        create: vi.fn().mockResolvedValue({
          id: '44444444-4444-4444-8444-444444444444',
        }),
      },
      notificacion: {
        create: vi.fn().mockResolvedValue({
          id: '55555555-5555-4555-8555-555555555555',
        }),
      },
    };

    prisma.producto.findMany.mockResolvedValue([expiredOffer]);
    prisma.$transaction.mockImplementation(
      async (
        callback: (transactionClient: typeof transaction) => Promise<boolean>,
      ) => callback(transaction),
    );

    const result = await service.expireOffers(now);

    expect(result).toBe(1);

    expect(prisma.producto.findMany).toHaveBeenCalledWith({
      where: {
        estado: 'ACTIVO',
        fechaVencimiento: {
          lte: new Date('2026-11-03T00:00:00.000Z'),
        },
      },
      select: {
        idProducto: true,
        comercioId: true,
        titulo: true,
        fechaVencimiento: true,
        comercio: {
          select: {
            userId: true,
          },
        },
      },
    });

    expect(transaction.producto.updateMany).toHaveBeenCalledWith({
      where: {
        idProducto: expiredOffer.idProducto,
        estado: 'ACTIVO',
      },
      data: {
        estado: 'VENCIDO_ELIMINADO',
      },
    });

    expect(
      transaction.auditoriaVencimientoOferta.create,
    ).toHaveBeenCalledWith({
      data: {
        productoId: expiredOffer.idProducto,
        comercioId: expiredOffer.comercioId,
        estadoAnterior: 'ACTIVO',
        estadoNuevo: 'VENCIDO_ELIMINADO',
        fechaVencimiento: expiredOffer.fechaVencimiento,
      },
    });

    expect(transaction.notificacion.create).toHaveBeenCalledWith({
      data: {
        usuarioId: expiredOffer.comercio.userId,
        auditoriaVencimientoId: '44444444-4444-4444-8444-444444444444',
        tipo: 'OFERTA_VENCIDA',
        titulo: 'Oferta vencida',
        mensaje:
          'La oferta "Canasta de verduras" fue retirada automáticamente por alcanzar su fecha de vencimiento.',
      },
    });
  });

  it('no procesa ofertas si no existen ofertas vencidas', async () => {
    prisma.producto.findMany.mockResolvedValue([]);

    const result = await service.expireOffers(now);

    expect(result).toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('no crea auditoría ni notificación si la oferta ya fue procesada', async () => {
    const transaction = {
      producto: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      auditoriaVencimientoOferta: {
        create: vi.fn(),
      },
      notificacion: {
        create: vi.fn(),
      },
    };

    prisma.producto.findMany.mockResolvedValue([expiredOffer]);
    prisma.$transaction.mockImplementation(
      async (
        callback: (transactionClient: typeof transaction) => Promise<boolean>,
      ) => callback(transaction),
    );

    const result = await service.expireOffers(now);

    expect(result).toBe(0);
    expect(transaction.auditoriaVencimientoOferta.create).not.toHaveBeenCalled();
    expect(transaction.notificacion.create).not.toHaveBeenCalled();
  });
});