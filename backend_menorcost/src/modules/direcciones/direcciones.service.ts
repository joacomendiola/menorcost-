import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Direccion } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ActualizarDireccionDto } from './dto/actualizar-direccion.dto.js';
import type { CrearDireccionDto } from './dto/crear-direccion.dto.js';

const DIRECCION_NO_ENCONTRADA = 'La dirección no existe';

@Injectable()
export class DireccionesService {
  constructor(private readonly prisma: PrismaService) {}

  listar(usuarioId: string): Promise<Direccion[]> {
    return this.prisma.direccion.findMany({
      where: { usuarioId, deletedAt: null },
      orderBy: [{ esPredeterminada: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async crear(usuarioId: string, dto: CrearDireccionDto): Promise<Direccion> {
    return this.prisma.$transaction(async (tx) => {
      const total = await tx.direccion.count({
        where: { usuarioId, deletedAt: null },
      });

      // La primera dirección siempre nace como predeterminada.
      const esPredeterminada = total === 0;

      return tx.direccion.create({
        data: {
          usuarioId,
          etiqueta: dto.etiqueta,
          calle: dto.calle,
          numero: dto.numero,
          piso: dto.piso,
          localidad: dto.localidad,
          descripcion: dto.descripcion,
          latitud: dto.latitud,
          longitud: dto.longitud,
          esPredeterminada,
        },
      });
    });
  }

  async actualizar(
    usuarioId: string,
    id: string,
    dto: ActualizarDireccionDto,
  ): Promise<Direccion> {
    await this.obtenerPropia(usuarioId, id);

    return this.prisma.direccion.update({
      where: { id },
      data: {
        etiqueta: dto.etiqueta,
        calle: dto.calle,
        numero: dto.numero,
        piso: dto.piso,
        localidad: dto.localidad,
        descripcion: dto.descripcion,
        latitud: dto.latitud,
        longitud: dto.longitud,
      },
    });
  }

  async eliminar(usuarioId: string, id: string): Promise<{ message: string }> {
    const direccion = await this.obtenerPropia(usuarioId, id);

    if (direccion.esPredeterminada) {
      throw new BadRequestException(
        'No se puede eliminar la dirección predeterminada. Asigná otra dirección como predeterminada antes de eliminarla.',
      );
    }

    await this.prisma.direccion.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Dirección eliminada correctamente.' };
  }

  async marcarPredeterminada(
    usuarioId: string,
    id: string,
  ): Promise<Direccion> {
    await this.obtenerPropia(usuarioId, id);

    const [, actualizada] = await this.prisma.$transaction([
      this.prisma.direccion.updateMany({
        where: { usuarioId, deletedAt: null, esPredeterminada: true },
        data: { esPredeterminada: false },
      }),
      this.prisma.direccion.update({
        where: { id },
        data: { esPredeterminada: true },
      }),
    ]);

    return actualizada;
  }

  private async obtenerPropia(usuarioId: string, id: string): Promise<Direccion> {
    const direccion = await this.prisma.direccion.findFirst({
      where: { id, usuarioId, deletedAt: null },
    });

    if (!direccion) {
      throw new NotFoundException(DIRECCION_NO_ENCONTRADA);
    }

    return direccion;
  }
}
