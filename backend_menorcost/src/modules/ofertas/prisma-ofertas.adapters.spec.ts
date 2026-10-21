import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateOfferDto } from './dto/create-oferta.dto.js';
import {
  PrismaOfferAccessAdapter,
  PrismaOfferCategoriesAdapter,
  PrismaOfferRepositoryAdapter,
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
    precioMenorcost: '75.00',
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
    },
  };

  let access: PrismaOfferAccessAdapter;
  let categories: PrismaOfferCategoriesAdapter;
  let repository: PrismaOfferRepositoryAdapter;
  let moduleRef: Awaited<
    ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>
  >;

  beforeEach(async () => {
    vi.clearAllMocks();

    prismaMock.usuario.findFirst.mockResolvedValue({
      rol: 'COMERCIANTE',
      estado: 'HABILITADO',
    });
    prismaMock.comercio.findFirst.mockResolvedValue({ idComercio: comercioId });
    prismaMock.categoria.findUnique.mockResolvedValue({
      idCategoria: categoriaId,
    });
    prismaMock.producto.create.mockResolvedValue({
      idProducto: '33333333-3333-4333-8333-333333333333',
      imagen: '/uploads/yogur.png',
    });

    moduleRef = await Test.createTestingModule({
      providers: [
        PrismaOfferAccessAdapter,
        PrismaOfferCategoriesAdapter,
        PrismaOfferRepositoryAdapter,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    access = moduleRef.get(PrismaOfferAccessAdapter);
    categories = moduleRef.get(PrismaOfferCategoriesAdapter);
    repository = moduleRef.get(PrismaOfferRepositoryAdapter);
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
      where: { idComercio: comercioId, usuarioId: userId },
      select: { idComercio: true },
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
      select: { idCategoria: true },
    });
  });

  it('rechaza una categoría inexistente', async () => {
    prismaMock.categoria.findUnique.mockResolvedValueOnce(null);

    await expect(
      categories.assertExists(categoriaId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('persiste el producto y devuelve su identificador e imagen', async () => {
    await expect(
      repository.create({
        ...dto,
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
        precioMenorcost: dto.precioMenorcost,
        imagen: '/uploads/yogur.png',
        estado: 'ACTIVO',
      },
      select: {
        idProducto: true,
        imagen: true,
      },
    });
  });
});