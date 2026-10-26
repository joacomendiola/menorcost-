import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateOfferDto } from './dto/create-oferta.dto.js';
import type { UpdateOfferDto } from './dto/update-oferta.dto.js';
import type {
  OfferAccess,
  OfferCategories,
  OfferDetails,
  OfferRecord,
  OfferRepository,
} from './ofertas-creation.ports.js';

const offerDetailsSelect = {
  idProducto: true,
  comercioId: true,
  categoriaId: true,
  tipo: true,
  titulo: true,
  descripcion: true,
  fechaVencimiento: true,
  stock: true,
  precioLista: true,
  precioMenorcost: true,
  imagen: true,
  estado: true,
} as const;

type OfferProjection = {
  idProducto: string;
  comercioId: string;
  categoriaId: string;
  tipo: OfferDetails['tipo'];
  titulo: string;
  descripcion: string;
  fechaVencimiento: Date;
  stock: number;
  precioLista: { toString(): string };
  precioMenorcost: { toString(): string };
  imagen: string;
  estado: OfferDetails['estado'];
};

function toOfferDetails(producto: OfferProjection): OfferDetails {
  return {
    id: producto.idProducto,
    comercioId: producto.comercioId,
    categoriaId: producto.categoriaId,
    tipo: producto.tipo,
    titulo: producto.titulo,
    descripcion: producto.descripcion,
    fechaVencimiento: producto.fechaVencimiento.toISOString().slice(0, 10),
    stock: producto.stock,
    precioLista: producto.precioLista.toString(),
    precioMenorcost: producto.precioMenorcost.toString(),
    imagen: producto.imagen,
    estado: producto.estado,
  };
}

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

  async listByOwner(userId: string): Promise<OfferDetails[]> {
    const productos = await this.prisma.producto.findMany({
      where: {
        comercio: {
          is: { usuarioId: userId },
        },
      },
      select: offerDetailsSelect,
      orderBy: { titulo: 'asc' },
    });

    return productos.map(toOfferDetails);
  }

  async findByIdForOwner(
    userId: string,
    offerId: string,
  ): Promise<OfferDetails | null> {
    const producto = await this.prisma.producto.findFirst({
      where: {
        idProducto: offerId,
        comercio: {
          is: { usuarioId: userId },
        },
      },
      select: offerDetailsSelect,
    });

    return producto ? toOfferDetails(producto) : null;
  }

  async updateForOwner(
    userId: string,
    offerId: string,
    data: UpdateOfferDto & { imagen?: string },
  ): Promise<OfferDetails | null> {
    const updateData = {
      ...(data.precioLista !== undefined
        ? { precioLista: data.precioLista }
        : {}),
      ...(data.precioMenorcost !== undefined
        ? { precioMenorcost: data.precioMenorcost }
        : {}),
      ...(data.stock !== undefined ? { stock: data.stock } : {}),
      ...(data.imagen !== undefined ? { imagen: data.imagen } : {}),
    };

    if (Object.keys(updateData).length === 0) {
      return this.findByIdForOwner(userId, offerId);
    }

    const result = await this.prisma.producto.updateMany({
      where: {
        idProducto: offerId,
        comercio: {
          is: { usuarioId: userId },
        },
      },
      data: updateData,
    });

    if (result.count === 0) {
      return null;
    }

    return this.findByIdForOwner(userId, offerId);
  }
}