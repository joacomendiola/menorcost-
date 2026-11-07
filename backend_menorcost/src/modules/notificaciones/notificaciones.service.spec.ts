import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificacionesService } from './notificaciones.service.js';

describe('NotificacionesService', () => {
  let service: NotificacionesService;

  const prisma = {
    notificacion: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };

  const notification = {
    id: '11111111-1111-4111-8111-111111111111',
    titulo: 'Oferta vencida',
    mensaje: 'La oferta fue retirada automáticamente.',
    tipo: 'OFERTA_VENCIDA',
    leida: false,
    createdAt: new Date('2026-11-03T03:00:00.000Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificacionesService(prisma as never);
  });

  it('lista únicamente las notificaciones del usuario autenticado', async () => {
    prisma.notificacion.findMany.mockResolvedValue([notification]);

    const result = await service.listarPorUsuario('usuario-1');

    expect(result).toEqual([notification]);
    expect(prisma.notificacion.findMany).toHaveBeenCalledWith({
      where: {
        usuarioId: 'usuario-1',
      },
      select: {
        id: true,
        titulo: true,
        mensaje: true,
        tipo: true,
        leida: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  });

  it('marca como leída una notificación perteneciente al usuario', async () => {
    prisma.notificacion.findFirst.mockResolvedValue({
      id: notification.id,
    });
    prisma.notificacion.update.mockResolvedValue({
      ...notification,
      leida: true,
    });

    const result = await service.marcarComoLeida(
      'usuario-1',
      notification.id,
    );

    expect(result).toEqual({
      ...notification,
      leida: true,
    });

    expect(prisma.notificacion.findFirst).toHaveBeenCalledWith({
      where: {
        id: notification.id,
        usuarioId: 'usuario-1',
      },
      select: {
        id: true,
      },
    });

    expect(prisma.notificacion.update).toHaveBeenCalledWith({
      where: {
        id: notification.id,
      },
      data: {
        leida: true,
      },
      select: {
        id: true,
        titulo: true,
        mensaje: true,
        tipo: true,
        leida: true,
        createdAt: true,
      },
    });
  });

  it('rechaza marcar una notificación de otro usuario', async () => {
    prisma.notificacion.findFirst.mockResolvedValue(null);

    await expect(
      service.marcarComoLeida('usuario-1', notification.id),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.notificacion.update).not.toHaveBeenCalled();
  });

  it('no modifica una notificación si no existe para el usuario autenticado', async () => {
    prisma.notificacion.findFirst.mockResolvedValue(null);

    await expect(
      service.marcarComoLeida('usuario-incorrecto', notification.id),
    ).rejects.toMatchObject({
      response: {
        message: 'La notificación no existe',
      },
    });

    expect(prisma.notificacion.update).not.toHaveBeenCalled();
  });
});