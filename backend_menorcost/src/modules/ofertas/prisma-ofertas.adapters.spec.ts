import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateOfferDto } from './dto/create-oferta.dto.js';
import {
  PrismaOfferAccessAdapter,
  PrismaOfferCategoriesAdapter,
  PrismaOfferRepositoryAdapter,
  PrismaOfferReservationsAdapter,
} from './prisma-ofertas.adapters.js';

describe('Adaptadores Prisma de ofertas', () => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const comercioId = '11111111-1111-4111-8111-111111111111';
  const categoriaId = '22222222-2222-4222-8222-222222222222';

  const dto: CreateOfferDto = {
    tipo: 'INDIVIDUAL',
    comercioId,
    categoriaId,
    titulo: 'Yogur',
    descripcion: 'Pack de yogures',
    fechaVencimiento: '2099-12-31',
    stock: 5,
    precioLista: '100.00',
    precioBaseNeto: '75.00',
  };

  const preciosCalculados = {
    precioBaseNeto: '75.00',
    precioPublico: '88.24',
    comisionMenorcostTasaAplicada: '0.1000',
    tasaMpEstimadaAplicada: '0.0650',
  };

  const productoProyectado = {
    idProducto: '33333333-3333-4333-8333-333333333333',
    comercioId,
    categoriaId,
    tipo: 'INDIVIDUAL' as const,
    titulo: 'Yogur',
    descripcion: 'Pack de yogures',
    fechaVencimiento: new Date('2099-12-31T00:00:00.000Z'),
    stock: 5,
    precioLista: '100.00',
    precioBaseNeto: '75.00',
    precioPublico: '88.24',
    comisionMenorcostTasaAplicada: '0.1000',
    tasaMpEstimadaAplicada: '0.0650',
    imagen: '/uploads/yogur.webp',
    estado: 'ACTIVO' as const,
  };

  const prismaMock = {
    usuario: {
      findFirst: vi.fn(),
    },
    comercio: {
      findFirst: vi.fn(),
    },
    categoria: {
      findUnique: vi.fn(),
    },
    producto: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    pedidoItem: {
      aggregate: vi.fn(),
    },
  };

  let access: PrismaOfferAccessAdapter;
  let categories: PrismaOfferCategoriesAdapter;
  let repository: PrismaOfferRepositoryAdapter;
  let reservations: PrismaOfferReservationsAdapter;
  let moduleRef: Awaited<
    ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>
  >;

  beforeEach(async () => {
    vi.clearAllMocks();

    prismaMock.usuario.findFirst.mockResolvedValue({
      rol: 'COMERCIANTE',
      estado: 'HABILITADO',
    });
    prismaMock.comercio.findFirst.mockResolvedValue({ idComercio: comercioId, estado: 'HABILITADO' });
    prismaMock.categoria.findUnique.mockResolvedValue({
      idCategoria: categoriaId,
      activa: true,
    });

    prismaMock.producto.create.mockResolvedValue({
      idProducto: '33333333-3333-4333-8333-333333333333',
      imagen: '/uploads/yogur.png',
      estado: 'ACTIVO',
    });
    prismaMock.producto.findMany.mockResolvedValue([productoProyectado]);
    prismaMock.producto.findFirst.mockResolvedValue(productoProyectado);
    prismaMock.producto.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.pedidoItem.aggregate.mockResolvedValue({
      _sum: { cantidad: 0 },
    });

    moduleRef = await Test.createTestingModule({
      providers: [
        PrismaOfferAccessAdapter,
        PrismaOfferCategoriesAdapter,
        PrismaOfferRepositoryAdapter,
        PrismaOfferReservationsAdapter,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    access = moduleRef.get(PrismaOfferAccessAdapter);
    categories = moduleRef.get(PrismaOfferCategoriesAdapter);
    repository = moduleRef.get(PrismaOfferRepositoryAdapter);
    reservations = moduleRef.get(PrismaOfferReservationsAdapter);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('permite publicar si el comerciante está habilitado y el comercio le pertenece', async () => {
    await expect(
      access.assertCanPublish(userId, comercioId),
    ).resolves.toBeUndefined();

    expect(prismaMock.usuario.findFirst).toHaveBeenCalledWith({
      where: { id: userId, deletedAt: null },
      select: { rol: true, estado: true },
    });

    expect(prismaMock.comercio.findFirst).toHaveBeenCalledWith({
      where: { idComercio: comercioId, userId },
      select: { idComercio: true, estado: true },
    });
  });

  it('rechaza a un usuario que no tiene rol de comerciante', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({
      rol: 'CLIENTE',
      estado: 'HABILITADO',
    });

    await expect(
      access.assertCanPublish(userId, comercioId),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.comercio.findFirst).not.toHaveBeenCalled();
  });

  it('rechaza a un comerciante cuya cuenta no está habilitada', async () => {
    prismaMock.usuario.findFirst.mockResolvedValueOnce({
      rol: 'COMERCIANTE',
      estado: 'SUSPENDIDO',
    });

    await expect(
      access.assertCanPublish(userId, comercioId),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.comercio.findFirst).not.toHaveBeenCalled();
  });

  it('rechaza si el comercio no pertenece al usuario', async () => {
    prismaMock.comercio.findFirst.mockResolvedValueOnce(null);

    await expect(
      access.assertCanPublish(userId, comercioId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza publicar ofertas en un comercio suspendido', async () => {
    prismaMock.comercio.findFirst.mockResolvedValueOnce({
      idComercio: comercioId,
      estado: 'SUSPENDIDO',
    });

    await expect(
      access.assertCanPublish(userId, comercioId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza si Mercado Pago no está marcado como vinculado', async () => {
    prismaMock.comercio.findFirst.mockResolvedValueOnce({
      mercadoPagoVinculado: false,
    });

    await expect(
      access.assertMercadoPagoLinked(userId, comercioId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('permite continuar si Mercado Pago está marcado como vinculado', async () => {
    prismaMock.comercio.findFirst.mockResolvedValueOnce({
      mercadoPagoVinculado: true,
    });

    await expect(
      access.assertMercadoPagoLinked(userId, comercioId),
    ).resolves.toBeUndefined();
  });

  it('acepta una categoría existente', async () => {
    await expect(
      categories.assertExists(categoriaId),
    ).resolves.toBeUndefined();

    expect(prismaMock.categoria.findUnique).toHaveBeenCalledWith({
      where: { idCategoria: categoriaId },
      select: { idCategoria: true, activa: true },
    });
  });

  it('rechaza una categoría inexistente', async () => {
    prismaMock.categoria.findUnique.mockResolvedValueOnce(null);

    await expect(
      categories.assertExists(categoriaId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza publicar ofertas en una categoría inactiva', async () => {
    prismaMock.categoria.findUnique.mockResolvedValueOnce({
      idCategoria: categoriaId,
      activa: false,
    });

    await expect(
      categories.assertExists(categoriaId),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('persiste el producto y devuelve su identificador e imagen', async () => {
    await expect(
      repository.create({
        ...dto,
        ...preciosCalculados,
        imagen: '/uploads/yogur.png',
        estado: 'ACTIVO',
      }),
    ).resolves.toEqual({
      id: '33333333-3333-4333-8333-333333333333',
      imagen: '/uploads/yogur.png',
      estado: 'ACTIVO',
    });

    expect(prismaMock.producto.create).toHaveBeenCalledWith({
      data: {
        tipo: dto.tipo,
        comercioId: dto.comercioId,
        categoriaId: dto.categoriaId,
        titulo: dto.titulo,
        descripcion: dto.descripcion,
        fechaVencimiento: new Date('2099-12-31T00:00:00.000Z'),
        stock: dto.stock,
        precioLista: dto.precioLista,
        precioBaseNeto: '75.00',
        precioPublico: '88.24',
        comisionMenorcostTasaAplicada: '0.1000',
        tasaMpEstimadaAplicada: '0.0650',
        imagen: '/uploads/yogur.png',
        estado: 'ACTIVO',
      },
      select: {
        idProducto: true,
        imagen: true,
        estado: true,
      },
    });
  });

  it('lista ofertas filtrando por el propietario del comercio', async () => {
    await expect(repository.listByOwner(userId)).resolves.toEqual([
      {
        id: productoProyectado.idProducto,
        comercioId,
        categoriaId,
        tipo: 'INDIVIDUAL',
        titulo: 'Yogur',
        descripcion: 'Pack de yogures',
        fechaVencimiento: '2099-12-31',
        stock: 5,
        precioLista: '100.00',
        precioBaseNeto: '75.00',
        precioPublico: '88.24',
        comisionMenorcostTasaAplicada: '0.1000',
        tasaMpEstimadaAplicada: '0.0650',
        imagen: '/uploads/yogur.webp',
        estado: 'ACTIVO',
      },
    ]);

    expect(prismaMock.producto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { comercio: { is: { userId } } },
      }),
    );
  });

  it('busca una oferta filtrando por ID y propietario', async () => {
    await expect(
      repository.findByIdForOwner(userId, productoProyectado.idProducto),
    ).resolves.toMatchObject({
      id: productoProyectado.idProducto,
      titulo: 'Yogur',
      precioBaseNeto: '75.00',
      precioPublico: '88.24',
    });

    expect(prismaMock.producto.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          idProducto: productoProyectado.idProducto,
          comercio: { is: { userId } },
        },
      }),
    );
  });

  it('actualiza una oferta propia usando una actualización parcial', async () => {
    const actualizacion = {
      precioBaseNeto: '70.00',
      precioPublico: '82.90',
      comisionMenorcostTasaAplicada: '0.1000',
      tasaMpEstimadaAplicada: '0.0650',
    };

    await expect(
      repository.updateForOwner(
        userId,
        productoProyectado.idProducto,
        actualizacion,
      ),
    ).resolves.toMatchObject({
      id: productoProyectado.idProducto,
      precioBaseNeto: '75.00',
      precioPublico: '88.24',
    });

    expect(prismaMock.producto.updateMany).toHaveBeenCalledWith({
      where: {
        idProducto: productoProyectado.idProducto,
        comercio: { is: { userId } },
      },
      data: actualizacion,
    });
  });

  it('no actualiza una oferta que no pertenece al usuario', async () => {
    prismaMock.producto.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      repository.updateForOwner(
        userId,
        productoProyectado.idProducto,
        { stock: 8 },
      ),
    ).resolves.toBeNull();

    expect(prismaMock.producto.findFirst).not.toHaveBeenCalled();
  });

  it('actualiza el estado de una oferta propia', async () => {
    prismaMock.producto.findFirst.mockResolvedValueOnce({
      ...productoProyectado,
      estado: 'PAUSADO',
    });

    await expect(
      repository.updateStatusForOwner(
        userId,
        productoProyectado.idProducto,
        'PAUSADO',
      ),
    ).resolves.toMatchObject({
      id: productoProyectado.idProducto,
      estado: 'PAUSADO',
    });

    expect(prismaMock.producto.updateMany).toHaveBeenCalledWith({
      where: {
        idProducto: productoProyectado.idProducto,
        comercio: { is: { userId } },
      },
      data: { estado: 'PAUSADO' },
    });
  });

  it('no cambia el estado de una oferta que no pertenece al comerciante', async () => {
    prismaMock.producto.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      repository.updateStatusForOwner(
        userId,
        productoProyectado.idProducto,
        'ELIMINADO',
      ),
    ).resolves.toBeNull();

    expect(prismaMock.producto.findFirst).not.toHaveBeenCalled();
  });

  it('suma las unidades de reservas pendientes de retiro de una oferta', async () => {
    prismaMock.pedidoItem.aggregate.mockResolvedValueOnce({
      _sum: { cantidad: 4 },
    });

    await expect(
      reservations.getReservedUnitsForOffer(productoProyectado.idProducto),
    ).resolves.toBe(4);

    expect(prismaMock.pedidoItem.aggregate).toHaveBeenCalledWith({
      where: {
        productoId: productoProyectado.idProducto,
        pedido: {
          is: { estado: 'PENDIENTE_DE_RETIRO' },
        },
      },
      _sum: { cantidad: true },
    });
  });

  it('devuelve cero cuando no hay unidades reservadas', async () => {
    prismaMock.pedidoItem.aggregate.mockResolvedValueOnce({
      _sum: { cantidad: null },
    });

    await expect(
      reservations.getReservedUnitsForOffer(productoProyectado.idProducto),
    ).resolves.toBe(0);
  });

  it('propaga el error si falla la consulta de reservas', async () => {
    const databaseError = new Error('Fallo al consultar reservas');
    prismaMock.pedidoItem.aggregate.mockRejectedValueOnce(databaseError);

    await expect(
      reservations.getReservedUnitsForOffer(productoProyectado.idProducto),
    ).rejects.toBe(databaseError);
  });
  it('suma las unidades pendientes de retiro de todas las ofertas del comerciante', async () => {
    prismaMock.pedidoItem.aggregate.mockResolvedValueOnce({
      _sum: { cantidad: 7 },
    });

    await expect(
      reservations.getReservedUnitsForOwner(userId),
    ).resolves.toBe(7);

    expect(
      prismaMock.pedidoItem.aggregate,
    ).toHaveBeenCalledWith({
      where: {
        producto: {
          is: {
            comercio: {
              is: { userId },
            },
          },
        },
        pedido: {
          is: {
            estado: 'PENDIENTE_DE_RETIRO',
          },
        },
      },
      _sum: {
        cantidad: true,
      },
    });
  });

  it('devuelve cero si el comerciante no tiene unidades reservadas', async () => {
    prismaMock.pedidoItem.aggregate.mockResolvedValueOnce({
      _sum: { cantidad: null },
    });

    await expect(
      reservations.getReservedUnitsForOwner(userId),
    ).resolves.toBe(0);
  });

  it('propaga el error si falla la consulta agregada del comerciante', async () => {
    const databaseError = new Error('Fallo al consultar reservas');
    prismaMock.pedidoItem.aggregate.mockRejectedValueOnce(databaseError);

    await expect(
      reservations.getReservedUnitsForOwner(userId),
    ).rejects.toBe(databaseError);
  });
})
