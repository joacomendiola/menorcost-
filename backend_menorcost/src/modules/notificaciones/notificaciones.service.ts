import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class NotificacionesService {
  constructor(private readonly prisma: PrismaService) {}

  async listarPorUsuario(usuarioId: string) {
    return this.prisma.notificacion.findMany({
      where: {
        usuarioId,
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
  }

  async marcarComoLeida(usuarioId: string, notificacionId: string) {
    const notificacion = await this.prisma.notificacion.findFirst({
      where: {
        id: notificacionId,
        usuarioId,
      },
      select: {
        id: true,
      },
    });

    if (!notificacion) {
      throw new NotFoundException('La notificación no existe');
    }

    return this.prisma.notificacion.update({
      where: {
        id: notificacion.id,
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
  }
}