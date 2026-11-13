import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CanastasService } from './canastas.service.js';

describe('CanastasService', () => {
  let service: CanastasService;

  const comercioId = '11111111-1111-4111-8111-111111111111';
  const usuarioId = '22222222-2222-4222-8222-222222222222';
  const productoId = '33333333-3333-4333-8333-333333333333';
  const canastaId = '44444444-4444-4444-8444-444444444444';
  const canastaItemId =
    '55555555-5555-4555-8555-555555555555';

  const comercio = {
    idComercio: comercioId,
    nombreFantasia: 'Comercio de prueba',
  };

  const producto = {
    idProducto: productoId,
    titulo: 'Canasta de verduras',
    imagen: '/uploads/verduras.jpg',
    stock: 10,
    precioPublico: '1250.50',
    estado: 'ACTIVO',
    fechaVencimiento: new Date('2099-12-31T00:00:00.000Z'),
  };

  const canastaSerializada = (cantidad: number) => ({
    idCanasta: canastaId,
    comercioId,
    comercio,
    items: [
      {
        idCanastaItem: canastaItemId,
        productoId,
        cantidad,
        producto,
      },
    ],
  });

  const prisma = {
    comercio: {
      findFirst: vi.fn(),
    },
    canasta: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    producto: {
      findFirst: vi.fn(),
    },
    canastaItem: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CanastasService(prisma as never);
  });

  it('devuelve una canasta vacía cuando el comercio está habilitado y no existe canasta', async () => {
    prisma.comercio.findFirst.mockResolvedValue(comercio);
    prisma.canasta.findUnique.mockResolvedValue(null);

    const resultado = await service.obtenerPorComercio(
      usuarioId,
      comercioId,
    );

    expect(resultado).toEqual({
      idCanasta: null,
      comercioId,
      comercio,
      subtotal: '0.00',
      items: [],
    });

    expect(prisma.comercio.findFirst).toHaveBeenCalledWith({
      where: {
        idComercio: comercioId,
        estado: 'HABILITADO',
      },
      select: {
        idComercio: true,
        nombreFantasia: true,
      },
    });
  });

  it('rechaza consultar la canasta de un comercio inexistente o no habilitado', async () => {
    prisma.comercio.findFirst.mockResolvedValue(null);

    await expect(
      service.obtenerPorComercio(usuarioId, comercioId),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.canasta.findUnique).not.toHaveBeenCalled();
  });

  it('agrega un producto y calcula el subtotal con el precio vigente', async () => {
    const transaction = {
      comercio: {
        findFirst: vi.fn().mockResolvedValue(comercio),
      },
      producto: {
        findFirst: vi.fn().mockResolvedValue(producto),
      },
      canasta: {
        upsert: vi.fn().mockResolvedValue({
          idCanasta: canastaId,
        }),
        findUnique: vi
          .fn()
          .mockResolvedValue(canastaSerializada(2)),
      },
      canastaItem: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
      },
    };

    prisma.$transaction.mockImplementation(
      async (
        callback: (
          transactionClient: typeof transaction,
        ) => Promise<unknown>,
      ) => callback(transaction),
    );

    const resultado = await service.agregarProducto(
      usuarioId,
      comercioId,
      {
        productoId,
        cantidad: 2,
      },
    );

    expect(resultado).toEqual({
      idCanasta: canastaId,
      comercioId,
      comercio,
      subtotal: '2501.00',
      items: [
        {
          idCanastaItem: canastaItemId,
          productoId,
          cantidad: 2,
          precioUnitario: '1250.50',
          subtotal: '2501.00',
          producto: {
            ...producto,
            precioPublico: '1250.50',
            fechaVencimiento: '2099-12-31',
          },
        },
      ],
    });

    expect(transaction.canasta.upsert).toHaveBeenCalledWith({
      where: {
        usuarioId_comercioId: {
          usuarioId,
          comercioId,
        },
      },
      create: {
        usuarioId,
        comercioId,
      },
      update: {
        updatedAt: expect.any(Date),
      },
    });

    expect(transaction.canastaItem.upsert).toHaveBeenCalledWith({
      where: {
        canastaId_productoId: {
          canastaId,
          productoId,
        },
      },
      create: {
        canastaId,
        productoId,
        cantidad: 2,
      },
      update: {
        cantidad: 2,
      },
    });

    expect(transaction.canasta.findUnique).toHaveBeenCalledWith({
      where: {
        idCanasta: canastaId,
      },
      include: {
        comercio: {
          select: {
            idComercio: true,
            nombreFantasia: true,
          },
        },
        items: {
          include: {
            producto: {
              select: {
                idProducto: true,
                titulo: true,
                imagen: true,
                stock: true,
                precioPublico: true,
                estado: true,
                fechaVencimiento: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
  });

  it('acumula la cantidad de un producto ya existente en la canasta', async () => {
    const transaction = {
      comercio: {
        findFirst: vi.fn().mockResolvedValue(comercio),
      },
      producto: {
        findFirst: vi.fn().mockResolvedValue(producto),
      },
      canasta: {
        upsert: vi.fn().mockResolvedValue({
          idCanasta: canastaId,
        }),
        findUnique: vi
          .fn()
          .mockResolvedValue(canastaSerializada(3)),
      },
      canastaItem: {
        findUnique: vi.fn().mockResolvedValue({
          cantidad: 2,
        }),
        upsert: vi.fn(),
      },
    };

    prisma.$transaction.mockImplementation(
      async (
        callback: (
          transactionClient: typeof transaction,
        ) => Promise<unknown>,
      ) => callback(transaction),
    );

    const resultado = await service.agregarProducto(
      usuarioId,
      comercioId,
      {
        productoId,
        cantidad: 1,
      },
    );

    expect(resultado.subtotal).toBe('3751.50');
    expect(resultado.items[0]).toMatchObject({
      productoId,
      cantidad: 3,
      precioUnitario: '1250.50',
      subtotal: '3751.50',
    });

    expect(transaction.canasta.upsert).toHaveBeenCalledWith({
      where: {
        usuarioId_comercioId: {
          usuarioId,
          comercioId,
        },
      },
      create: {
        usuarioId,
        comercioId,
      },
      update: {
        updatedAt: expect.any(Date),
      },
    });

    expect(transaction.canastaItem.upsert).toHaveBeenCalledWith({
      where: {
        canastaId_productoId: {
          canastaId,
          productoId,
        },
      },
      create: {
        canastaId,
        productoId,
        cantidad: 1,
      },
      update: {
        cantidad: 3,
      },
    });
  });

  it('rechaza agregar una cantidad superior al stock disponible', async () => {
    const transaction = {
      comercio: {
        findFirst: vi.fn().mockResolvedValue(comercio),
      },
      producto: {
        findFirst: vi.fn().mockResolvedValue({
          ...producto,
          stock: 2,
        }),
      },
      canasta: {
        upsert: vi.fn().mockResolvedValue({
          idCanasta: canastaId,
        }),
      },
      canastaItem: {
        findUnique: vi.fn().mockResolvedValue({
          cantidad: 2,
        }),
        upsert: vi.fn(),
      },
    };

    prisma.$transaction.mockImplementation(
      async (
        callback: (
          transactionClient: typeof transaction,
        ) => Promise<unknown>,
      ) => callback(transaction),
    );

    await expect(
      service.agregarProducto(usuarioId, comercioId, {
        productoId,
        cantidad: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(transaction.canastaItem.upsert).not.toHaveBeenCalled();
  });

  it('rechaza agregar un producto vencido', async () => {
    const transaction = {
      comercio: {
        findFirst: vi.fn().mockResolvedValue(comercio),
      },
      producto: {
        findFirst: vi.fn().mockResolvedValue({
          ...producto,
          fechaVencimiento: new Date(
            '2020-01-01T00:00:00.000Z',
          ),
        }),
      },
      canasta: {
        upsert: vi.fn(),
      },
      canastaItem: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
    };

    prisma.$transaction.mockImplementation(
      async (
        callback: (
          transactionClient: typeof transaction,
        ) => Promise<unknown>,
      ) => callback(transaction),
    );

    await expect(
      service.agregarProducto(usuarioId, comercioId, {
        productoId,
        cantidad: 1,
      }),
    ).rejects.toMatchObject({
      response: {
        message: 'El producto está vencido.',
      },
    });

    expect(transaction.canasta.upsert).not.toHaveBeenCalled();
    expect(transaction.canastaItem.upsert).not.toHaveBeenCalled();
  });

  it('rechaza agregar un producto que no pertenece al comercio', async () => {
    const transaction = {
      comercio: {
        findFirst: vi.fn().mockResolvedValue(comercio),
      },
      producto: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      canasta: {
        upsert: vi.fn(),
      },
      canastaItem: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
    };

    prisma.$transaction.mockImplementation(
      async (
        callback: (
          transactionClient: typeof transaction,
        ) => Promise<unknown>,
      ) => callback(transaction),
    );

    await expect(
      service.agregarProducto(usuarioId, comercioId, {
        productoId,
        cantidad: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(transaction.canasta.upsert).not.toHaveBeenCalled();
  });

    it('actualiza la cantidad de un producto en la canasta', async () => {
    const canasta = {
      idCanasta: canastaId,
    };

    const transaction = {
      canasta: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(canasta)
          .mockResolvedValueOnce(canastaSerializada(4)),
        update: vi.fn(),
      },
      producto: {
        findFirst: vi.fn().mockResolvedValue(producto),
      },
      canastaItem: {
        findUnique: vi.fn().mockResolvedValue({
          idCanastaItem: canastaItemId,
          cantidad: 2,
        }),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    prisma.$transaction.mockImplementation(
      async (
        callback: (
          transactionClient: typeof transaction,
        ) => Promise<unknown>,
      ) => callback(transaction),
    );

    const resultado = await service.actualizarProducto(
      usuarioId,
      comercioId,
      productoId,
      { cantidad: 4 },
    );

    expect(resultado.items[0]).toMatchObject({
      productoId,
      cantidad: 4,
      precioUnitario: '1250.50',
      subtotal: '5002.00',
    });

    expect(transaction.canastaItem.update).toHaveBeenCalledWith({
      where: {
        idCanastaItem: canastaItemId,
      },
      data: {
        cantidad: 4,
      },
    });

    expect(transaction.canasta.update).toHaveBeenCalledWith({
      where: {
        idCanasta: canastaId,
      },
      data: {
        updatedAt: expect.any(Date),
      },
    });
  });

    it('rechaza actualizar una cantidad superior al stock', async () => {
    const transaction = {
      canasta: {
        findUnique: vi.fn().mockResolvedValue({
          idCanasta: canastaId,
        }),
        update: vi.fn(),
      },
      producto: {
        findFirst: vi.fn().mockResolvedValue({
          ...producto,
          stock: 3,
        }),
      },
      canastaItem: {
        findUnique: vi.fn().mockResolvedValue({
          idCanastaItem: canastaItemId,
          cantidad: 2,
        }),
        update: vi.fn(),
      },
    };

    prisma.$transaction.mockImplementation(
      async (
        callback: (
          transactionClient: typeof transaction,
        ) => Promise<unknown>,
      ) => callback(transaction),
    );

    await expect(
      service.actualizarProducto(
        usuarioId,
        comercioId,
        productoId,
        { cantidad: 4 },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(transaction.canastaItem.update).not.toHaveBeenCalled();
    expect(transaction.canasta.update).not.toHaveBeenCalled();
  });

    it('elimina un producto de la canasta y actualiza la fecha de modificación', async () => {
    const transaction = {
      canasta: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            idCanasta: canastaId,
          })
          .mockResolvedValueOnce({
            ...canastaSerializada(1),
            items: [],
          }),
        update: vi.fn(),
      },
      canastaItem: {
        findUnique: vi.fn().mockResolvedValue({
          idCanastaItem: canastaItemId,
          cantidad: 2,
        }),
        delete: vi.fn(),
      },
    };

    prisma.$transaction.mockImplementation(
      async (
        callback: (
          transactionClient: typeof transaction,
        ) => Promise<unknown>,
      ) => callback(transaction),
    );

    const resultado = await service.eliminarProducto(
      usuarioId,
      comercioId,
      productoId,
    );

    expect(resultado).toEqual({
      idCanasta: canastaId,
      comercioId,
      comercio,
      subtotal: '0.00',
      items: [],
    });

    expect(transaction.canastaItem.delete).toHaveBeenCalledWith({
      where: {
        idCanastaItem: canastaItemId,
      },
    });

    expect(transaction.canasta.update).toHaveBeenCalledWith({
      where: {
        idCanasta: canastaId,
      },
      data: {
        updatedAt: expect.any(Date),
      },
    });
  });

    it('rechaza eliminar un producto que no está en la canasta', async () => {
    const transaction = {
      canasta: {
        findUnique: vi.fn().mockResolvedValue({
          idCanasta: canastaId,
        }),
        update: vi.fn(),
      },
      canastaItem: {
        findUnique: vi.fn().mockResolvedValue(null),
        delete: vi.fn(),
      },
    };

    prisma.$transaction.mockImplementation(
      async (
        callback: (
          transactionClient: typeof transaction,
        ) => Promise<unknown>,
      ) => callback(transaction),
    );

    await expect(
      service.eliminarProducto(
        usuarioId,
        comercioId,
        productoId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(transaction.canastaItem.delete).not.toHaveBeenCalled();
    expect(transaction.canasta.update).not.toHaveBeenCalled();
  });

});