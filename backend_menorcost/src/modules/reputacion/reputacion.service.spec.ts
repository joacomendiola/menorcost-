import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReputacionService } from './reputacion.service.js';

const PEDIDO_ID = '11111111-1111-4111-8111-111111111111';
const COMERCIO_ID = '22222222-2222-4222-8222-222222222222';

const prismaMock = {
  pedido: { findUnique: vi.fn() },
  calificacion: {
    create: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
  comercio: { findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
};

const service = new ReputacionService(prismaMock as never);

function pedidoBase(overrides: Record<string, unknown> = {}) {
  return {
    id_pedido: PEDIDO_ID,
    usuarioId: 'u1',
    comercioId: COMERCIO_ID,
    estado: 'ENTREGADO',
    calificacion: null,
    ...overrides,
  };
}

function calificacionBase(overrides: Record<string, unknown> = {}) {
  return {
    id_calificacion: 1,
    id_pedido: PEDIDO_ID,
    puntaje: 5,
    comentario: 'Excelente',
    fecha_creacion: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  prismaMock.$transaction.mockImplementation(async (arg: any) => {
    if (typeof arg === 'function') return arg(prismaMock);
    return Promise.all(arg);
  });

  prismaMock.pedido.findUnique.mockResolvedValue(pedidoBase());
  prismaMock.calificacion.create.mockResolvedValue(calificacionBase());
  prismaMock.calificacion.aggregate.mockResolvedValue({
    _avg: { puntaje: 4.5 },
    _count: { id_calificacion: 2 },
  });
  prismaMock.calificacion.groupBy.mockResolvedValue([]);
  prismaMock.calificacion.findMany.mockResolvedValue([]);
  prismaMock.comercio.update.mockResolvedValue({});
});

describe('ReputacionService.crearCalificacion', () => {
  it('rechaza pedidos inexistentes', async () => {
    prismaMock.pedido.findUnique.mockResolvedValue(null);

    await expect(
      service.crearCalificacion('u1', { idPedido: PEDIDO_ID, puntaje: 5 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza pedidos de otro cliente', async () => {
    prismaMock.pedido.findUnique.mockResolvedValue(
      pedidoBase({ usuarioId: 'otro' }),
    );

    await expect(
      service.crearCalificacion('u1', { idPedido: PEDIDO_ID, puntaje: 5 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza pedidos que no están ENTREGADO', async () => {
    prismaMock.pedido.findUnique.mockResolvedValue(
      pedidoBase({ estado: 'PENDIENTE_DE_RETIRO' }),
    );

    await expect(
      service.crearCalificacion('u1', { idPedido: PEDIDO_ID, puntaje: 5 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza pedidos ya calificados', async () => {
    prismaMock.pedido.findUnique.mockResolvedValue(
      pedidoBase({ calificacion: calificacionBase() }),
    );

    await expect(
      service.crearCalificacion('u1', { idPedido: PEDIDO_ID, puntaje: 5 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('crea la calificación y recalcula la reputación del comercio', async () => {
    const resultado = await service.crearCalificacion('u1', {
      idPedido: PEDIDO_ID,
      puntaje: 5,
      comentario: 'Excelente',
    });

    expect(prismaMock.calificacion.create).toHaveBeenCalledWith({
      data: {
        id_pedido: PEDIDO_ID,
        puntaje: 5,
        comentario: 'Excelente',
      },
    });
    expect(prismaMock.calificacion.aggregate).toHaveBeenCalledWith({
      _avg: { puntaje: true },
      _count: { id_calificacion: true },
      where: { pedido: { comercioId: COMERCIO_ID, estado: 'ENTREGADO' } },
    });
    expect(prismaMock.comercio.update).toHaveBeenCalledWith({
      where: { idComercio: COMERCIO_ID },
      data: { reputacionPromedio: 4.5, totalCalificaciones: 2 },
    });
    expect(resultado).toMatchObject({
      reputacionComercio: { promedio: 4.5, total: 2 },
    });
  });

  it('redondea el promedio a un decimal y tolera comercios sin calificaciones', async () => {
    prismaMock.calificacion.aggregate.mockResolvedValue({
      _avg: { puntaje: null },
      _count: { id_calificacion: 0 },
    });

    const resultado = await service.crearCalificacion('u1', {
      idPedido: PEDIDO_ID,
      puntaje: 4,
    });

    expect(prismaMock.comercio.update).toHaveBeenCalledWith({
      where: { idComercio: COMERCIO_ID },
      data: { reputacionPromedio: 0, totalCalificaciones: 0 },
    });
    expect(resultado).toMatchObject({
      reputacionComercio: { promedio: 0, total: 0 },
    });
  });

  it('convierte el error único P2002 en conflicto', async () => {
    prismaMock.$transaction.mockRejectedValueOnce({ code: 'P2002' });

    await expect(
      service.crearCalificacion('u1', { idPedido: PEDIDO_ID, puntaje: 5 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('reintenta ante un conflicto de serialización P2034', async () => {
    prismaMock.$transaction
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce(async (arg: any) => arg(prismaMock));

    const resultado = await service.crearCalificacion('u1', {
      idPedido: PEDIDO_ID,
      puntaje: 5,
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
    expect(resultado).toMatchObject({ calificacion: { puntaje: 5 } });
  });

  it('deja de reintentar después de tres conflictos de serialización', async () => {
    prismaMock.$transaction.mockRejectedValue({ code: 'P2034' });

    await expect(
      service.crearCalificacion('u1', { idPedido: PEDIDO_ID, puntaje: 5 }),
    ).rejects.toMatchObject({ code: 'P2034' });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(3);
  });
});

describe('ReputacionService.obtenerReputacionComercioPorUsuario', () => {
  it('rechaza usuarios sin comercio asociado', async () => {
    prismaMock.comercio.findUnique.mockResolvedValue(null);

    await expect(
      service.obtenerReputacionComercioPorUsuario('u1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('delega en el comercio del usuario autenticado', async () => {
    prismaMock.comercio.findUnique.mockResolvedValue({
      idComercio: COMERCIO_ID,
    });

    const resultado = await service.obtenerReputacionComercioPorUsuario('u1');

    expect(prismaMock.comercio.findUnique).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
    expect(resultado.totalResenas).toBe(0);
  });
});

describe('ReputacionService.obtenerReputacionComercio', () => {
  it('calcula promedio, distribución y paginación', async () => {
    prismaMock.calificacion.groupBy.mockResolvedValue([
      { puntaje: 5, _count: 2 },
      { puntaje: 4, _count: 1 },
    ]);
    prismaMock.calificacion.findMany.mockResolvedValue([
      {
        id_calificacion: 10,
        puntaje: 5,
        comentario: 'Muy bueno',
        fecha_creacion: new Date('2026-01-03T00:00:00.000Z'),
        pedido: { usuario: { nombre: 'Ana', apellido: 'Paz' } },
      },
      {
        id_calificacion: 9,
        puntaje: 4,
        comentario: null,
        fecha_creacion: new Date('2026-01-02T00:00:00.000Z'),
        pedido: { usuario: { nombre: 'Luis', apellido: 'Gómez' } },
      },
      {
        id_calificacion: 8,
        puntaje: 5,
        comentario: 'Excelente',
        fecha_creacion: new Date('2026-01-01T00:00:00.000Z'),
        pedido: { usuario: { nombre: 'Eva', apellido: 'Ruiz' } },
      },
    ]);

    const resultado = await service.obtenerReputacionComercio(COMERCIO_ID, {
      limit: 2,
    });

    expect(prismaMock.calificacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3,
        where: {
          pedido: { comercioId: COMERCIO_ID, estado: 'ENTREGADO' },
        },
        orderBy: [
          { fecha_creacion: 'desc' },
          { id_calificacion: 'desc' },
        ],
      }),
    );
    expect(resultado.promedio).toBe(4.7);
    expect(resultado.totalResenas).toBe(3);
    expect(resultado.distribucion).toEqual({
      '5': 2,
      '4': 1,
      '3': 0,
      '2': 0,
      '1': 0,
    });
    expect(resultado.resenas).toHaveLength(2);
    expect(resultado.resenas[1].comentario).toBe('');
    expect(resultado.paginacion).toEqual({
      limit: 2,
      nextCursor: 9,
      hasMore: true,
    });
  });

  it('devuelve valores vacíos cuando no hay reseñas', async () => {
    const resultado = await service.obtenerReputacionComercio(COMERCIO_ID);

    expect(resultado).toEqual({
      promedio: 0,
      totalResenas: 0,
      distribucion: {
        '5': 0,
        '4': 0,
        '3': 0,
        '2': 0,
        '1': 0,
      },
      resenas: [],
      paginacion: { limit: 10, nextCursor: null, hasMore: false },
    });
  });

  it('aplica el cursor y el límite máximo permitido', async () => {
    await service.obtenerReputacionComercio(COMERCIO_ID, {
      limit: 999,
      cursor: 42,
    });

    expect(prismaMock.calificacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 51,
        cursor: { id_calificacion: 42 },
        skip: 1,
      }),
    );
  });

  it('usa un nombre anónimo cuando la reseña no tiene cliente asociado', async () => {
    prismaMock.calificacion.findMany.mockResolvedValue([
      {
        id_calificacion: 7,
        puntaje: 5,
        comentario: 'Bueno',
        fecha_creacion: new Date('2026-01-01T00:00:00.000Z'),
        pedido: null,
      },
    ]);

    const resultado = await service.obtenerReputacionComercio(COMERCIO_ID);

    expect(resultado.resenas[0].clienteNombre).toBe('Cliente Anónimo');
  });
});

describe('ReputacionService.recalcularReputacionComercio', () => {
  it('redondea el promedio y persiste el total', async () => {
    prismaMock.calificacion.aggregate.mockResolvedValue({
      _avg: { puntaje: 4.444 },
      _count: { id_calificacion: 3 },
    });

    const resultado = await service.recalcularReputacionComercio(COMERCIO_ID);

    expect(resultado).toEqual({ promedio: 4.4, total: 3 });
    expect(prismaMock.comercio.update).toHaveBeenCalledWith({
      where: { idComercio: COMERCIO_ID },
      data: { reputacionPromedio: 4.4, totalCalificaciones: 3 },
    });
  });
});
