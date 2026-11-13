import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateOfferDto } from './dto/create-oferta.dto.js';
import type { UpdateOfferDto } from './dto/update-oferta.dto.js';
import type {
  CalculatedOfferPrices,
  ManageableOfferStatus,
  OfferAccess,
  OfferCategories,
  OfferDetails,
  OfferRecord,
  OfferRepository,
  OfferReservations,
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
  precioBaseNeto: true,
  precioPublico: true,
  comisionMenorcostTasaAplicada: true,
  tasaMpEstimadaAplicada: true,
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
  precioBaseNeto: { toString(): string };
  precioPublico: { toString(): string };
  comisionMenorcostTasaAplicada: { toString(): string };
  tasaMpEstimadaAplicada: { toString(): string };
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
    fechaVencimiento: producto.fechaVencimiento
      .toISOString()
      .slice(0, 10),
    stock: producto.stock,
    precioLista: producto.precioLista.toString(),
    precioBaseNeto: producto.precioBaseNeto.toString(),
    precioPublico: producto.precioPublico.toString(),
    comisionMenorcostTasaAplicada:
      producto.comisionMenorcostTasaAplicada.toString(),
    tasaMpEstimadaAplicada:
      producto.tasaMpEstimadaAplicada.toString(),
    imagen: producto.imagen,
    estado: producto.estado,
  };
}

@Injectable()
export class PrismaOfferAccessAdapter implements OfferAccess {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanPublish(
    userId: string,
    comercioId: string,
  ): Promise<void> {
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
        userId,
      },
      select: { idComercio: true, estado: true },
    });

    if (!comercio || comercio.estado !== 'HABILITADO') {
      throw new ForbiddenException(
        'El comercio no existe, no pertenece al usuario autenticado o no está habilitado',
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
        userId,
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
      select: { idCategoria: true, activa: true },
    });

    if (!categoria) {
      throw new NotFoundException('La categoría indicada no existe');
    }

    if (!categoria.activa) {
      throw new BadRequestException('La categoría indicada no está activa');
    }

  }
}

@Injectable()
export class PrismaOfferRepositoryAdapter implements OfferRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: CreateOfferDto &
      CalculatedOfferPrices & {
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
        precioBaseNeto: data.precioBaseNeto,
        precioPublico: data.precioPublico,
        comisionMenorcostTasaAplicada:
          data.comisionMenorcostTasaAplicada,
        tasaMpEstimadaAplicada: data.tasaMpEstimadaAplicada,
        imagen: data.imagen,
        estado: data.estado,
      },
      select: {
        idProducto: true,
        imagen: true,
        estado: true,
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
          is: { userId },
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
          is: { userId },
        },
      },
      select: offerDetailsSelect,
    });

    return producto ? toOfferDetails(producto) : null;
  }

  async updateForOwner(
    userId: string,
    offerId: string,
    data: Partial<CalculatedOfferPrices> &
      Pick<UpdateOfferDto, 'precioLista' | 'stock'> & {
        imagen?: string;
      },
  ): Promise<OfferDetails | null> {
    const updateData = {
      ...(data.precioLista !== undefined
        ? { precioLista: data.precioLista }
        : {}),
      ...(data.precioBaseNeto !== undefined
        ? { precioBaseNeto: data.precioBaseNeto }
        : {}),
      ...(data.precioPublico !== undefined
        ? { precioPublico: data.precioPublico }
        : {}),
      ...(data.comisionMenorcostTasaAplicada !== undefined
        ? {
            comisionMenorcostTasaAplicada:
              data.comisionMenorcostTasaAplicada,
          }
        : {}),
      ...(data.tasaMpEstimadaAplicada !== undefined
        ? {
            tasaMpEstimadaAplicada:
              data.tasaMpEstimadaAplicada,
          }
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
          is: { userId },
        },
      },
      data: updateData,
    });

    if (result.count === 0) {
      return null;
    }

    return this.findByIdForOwner(userId, offerId);
  }

  async updateStatusForOwner(
    userId: string,
    offerId: string,
    estado: ManageableOfferStatus,
  ): Promise<OfferDetails | null> {
    const result = await this.prisma.producto.updateMany({
      where: {
        idProducto: offerId,
        comercio: {
          is: { userId },
        },
      },
      data: { estado },
    });

    if (result.count === 0) {
      return null;
    }

    return this.findByIdForOwner(userId, offerId);
  }
}

@Injectable()
export class PrismaOfferReservationsAdapter implements OfferReservations {
  constructor(private readonly prisma: PrismaService) { }

  async getReservedUnitsForOffer(offerId: string): Promise<number> {
    const result = await this.prisma.pedidoItem.aggregate({
      where: {
        productoId: offerId,
        pedido: {
          is: { estado: 'PENDIENTE_DE_RETIRO' },
        },
      },
      _sum: { cantidad: true },
    });

    return result._sum.cantidad ?? 0;
  }

  async getReservedUnitsForOwner(
    userId: string,
  ): Promise<number> {
    const result = await this.prisma.pedidoItem.aggregate({
      where: {
        producto: {
          is: {
            comercio: {
              is: {
                userId,
              },
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

    return result._sum.cantidad ?? 0;
  }
}
