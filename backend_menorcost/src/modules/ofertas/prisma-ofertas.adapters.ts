import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateOfferDto } from './dto/create-offer.dto.js';
import type {
  OfferAccess,
  OfferCategories,
  OfferRecord,
  OfferRepository,
} from './ofertas-creation.ports.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class PrismaOfferAccessAdapter implements OfferAccess {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanPublish(userId: string, comercioId: string): Promise<void> {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: userId, deletedAt: null },
      select: { rol: true, estado: true },
    });

    if (
      !usuario ||
      usuario.rol !== 'COMERCIANTE' ||
      usuario.estado !== 'HABILITADO'
    ) {
      throw new ForbiddenException(
        'Se requiere una cuenta de comerciante habilitada',
      );
    }

    const comercio = await this.prisma.comercio.findFirst({
      where: {
        idComercio: comercioId,
        usuarioId: userId,
      },
      select: { idComercio: true },
    });

    if (!comercio) {
      throw new ForbiddenException(
        'El comercio no existe o no pertenece al usuario autenticado',
      );
    }
  }

  async assertMercadoPagoLinked(
    userId: string,
    comercioId: string,
  ): Promise<void> {
    const comercio = await this.prisma.comercio.findFirst({
      where: {
        idComercio: comercioId,
        usuarioId: userId,
      },
      select: { mercadoPagoVinculado: true },
    });

    if (!comercio?.mercadoPagoVinculado) {
      throw new ForbiddenException(
        'El comercio todavía no tiene Mercado Pago marcado como vinculado',
      );
    }

    // TODO integración: reemplazar este booleano local por la comprobación
    // real de la cuenta y las credenciales de Mercado Pago.
  }
}

@Injectable()
export class PrismaOfferCategoriesAdapter implements OfferCategories {
  constructor(private readonly prisma: PrismaService) {}

  async assertExists(categoriaId: string): Promise<void> {
    const categoria = await this.prisma.categoria.findUnique({
      where: { idCategoria: categoriaId },
      select: { idCategoria: true },
    });

    if (!categoria) {
      throw new NotFoundException('La categoría indicada no existe');
    }

    // TODO integración: comprobar también que la categoría esté activa
    // cuando el modelo real incluya ese estado.
  }
}

@Injectable()
export class PrismaOfferRepositoryAdapter implements OfferRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: CreateOfferDto & {
      imagen: string;
      estado: 'ACTIVO';
    },
  ): Promise<OfferRecord> {
    const producto = await this.prisma.producto.create({
      data: {
        tipo: data.tipo,
        comercioId: data.comercioId,
        categoriaId: data.categoriaId,
        titulo: data.titulo,
        descripcion: data.descripcion,
        fechaVencimiento: new Date(
          `${data.fechaVencimiento}T00:00:00.000Z`,
        ),
        stock: data.stock,
        precioLista: data.precioLista,
        precioMenorcost: data.precioMenorcost,
        imagen: data.imagen,
        estado: data.estado,
      },
      select: {
        idProducto: true,
        imagen: true,
      },
    });

    return {
      id: producto.idProducto,
      imagen: producto.imagen,
      estado: 'ACTIVO',
    };
  }
}