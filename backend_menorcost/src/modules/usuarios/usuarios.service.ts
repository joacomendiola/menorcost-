import { Injectable, NotFoundException } from '@nestjs/common';
import type { Direccion } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { DireccionesService } from '../direcciones/direcciones.service.js';
import type { ActualizarPerfilDto } from './dto/actualizar-perfil.dto.js';

const SELECT_PERFIL = {
  id: true,
  dni: true,
  nombre: true,
  apellido: true,
  email: true,
  telefono: true,
  fechaNacimiento: true,
  rol: true,
  estado: true,
  createdAt: true,
} as const;

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly direcciones: DireccionesService,
  ) {}

  async obtenerPerfil(usuarioId: string) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: usuarioId, deletedAt: null },
      select: SELECT_PERFIL,
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const direcciones: Direccion[] = await this.direcciones.listar(usuarioId);

    return { ...usuario, direcciones };
  }

  async actualizarPerfil(usuarioId: string, dto: ActualizarPerfilDto) {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: usuarioId, deletedAt: null },
      select: { id: true },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        nombre: dto.nombre,
        apellido: dto.apellido,
        telefono: dto.telefono,
      },
      select: SELECT_PERFIL,
    });
  }
}
