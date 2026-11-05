import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AgregarCanastaItemDto } from './dto/agregar-canasta-item.dto.js';

@Injectable()
export class CanastasService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerPorComercio(usuarioId: string, comercioId: string) {
    const comercio = await this.prisma.comercio.findFirst({
      where: {
        idComercio: comercioId,
        estado: 'HABILITADO',
      },
      select: {
        idComercio: true,
        nombreFantasia: true,
      },
    });

    if (!comercio) {
      throw new NotFoundException(
        'El comercio no existe o no está habilitado.',
      );
    }

    const canasta = await this.prisma.canasta.findUnique({
      where: {
        usuarioId_comercioId: {
          usuarioId,
          comercioId,
        },
      },
      include: {
        comercio: {
          select: {
            idComercio: true,
            nombreFantasia: true,
          },
        },
        items: {
          include: {
            producto: {
              select: {
                idProducto: true,
                titulo: true,
                imagen: true,
                stock: true,
                precioMenorcost: true,
                estado: true,
                fechaVencimiento: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!canasta) {
      return {
        idCanasta: null,
        comercioId,
        comercio,
        subtotal: '0.00',
        items: [],
      };
    }

    return this.serializarCanasta(canasta);
  }

  async agregarProducto(
    usuarioId: string,
    comercioId: string,
    dto: AgregarCanastaItemDto,
  ) {
    const hoy = this.obtenerFechaActualArgentina();

    return this.prisma.$transaction(async (tx) => {
      const comercio = await tx.comercio.findFirst({
        where: {
          idComercio: comercioId,
          estado: 'HABILITADO',
        },
        select: {
          idComercio: true,
          nombreFantasia: true,
        },
      });

      if (!comercio) {
        throw new NotFoundException(
          'El comercio no existe o no está habilitado.',
        );
      }

      const producto = await tx.producto.findFirst({
        where: {
          idProducto: dto.productoId,
          comercioId,
        },
        select: {
          idProducto: true,
          titulo: true,
          stock: true,
          precioMenorcost: true,
          estado: true,
          fechaVencimiento: true,
        },
      });

      if (!producto) {
        throw new NotFoundException(
          'El producto no existe o no pertenece a este comercio.',
        );
      }

      if (producto.estado !== 'ACTIVO') {
        throw new BadRequestException(
          'El producto no está disponible actualmente.',
        );
      }

      if (this.obtenerFechaProducto(producto.fechaVencimiento) < hoy) {
        throw new BadRequestException('El producto está vencido.');
      }

      const canasta = await tx.canasta.upsert({
        where: {
          usuarioId_comercioId: {
            usuarioId,
            comercioId,
          },
        },
        create: {
          usuarioId,
          comercioId,
          subtotal: 0,
        },
        update: {},
      });

      const itemExistente = await tx.canastaItem.findUnique({
        where: {
          canastaId_productoId: {
            canastaId: canasta.idCanasta,
            productoId: dto.productoId,
          },
        },
        select: {
          cantidad: true,
        },
      });

      const cantidadFinal = (itemExistente?.cantidad ?? 0) + dto.cantidad;

      if (cantidadFinal > producto.stock) {
        throw new BadRequestException(
          `La cantidad solicitada supera el stock disponible de "${producto.titulo}".`,
        );
      }

      await tx.canastaItem.upsert({
        where: {
          canastaId_productoId: {
            canastaId: canasta.idCanasta,
            productoId: dto.productoId,
          },
        },
        create: {
          canastaId: canasta.idCanasta,
          productoId: dto.productoId,
          cantidad: dto.cantidad,
        },
        update: {
          cantidad: cantidadFinal,
        },
      });

      const items = await tx.canastaItem.findMany({
        where: {
          canastaId: canasta.idCanasta,
        },
        include: {
          producto: {
            select: {
              idProducto: true,
              titulo: true,
              imagen: true,
              stock: true,
              precioMenorcost: true,
              estado: true,
              fechaVencimiento: true,
            },
          },
        },
      });

      const subtotal = items.reduce(
        (total, item) =>
          total + Number(item.producto.precioMenorcost) * item.cantidad,
        0,
      );

      const canastaActualizada = await tx.canasta.update({
        where: {
          idCanasta: canasta.idCanasta,
        },
        data: {
          subtotal: subtotal.toFixed(2),
        },
        include: {
          comercio: {
            select: {
              idComercio: true,
              nombreFantasia: true,
            },
          },
          items: {
            include: {
              producto: {
                select: {
                  idProducto: true,
                  titulo: true,
                  imagen: true,
                  stock: true,
                  precioMenorcost: true,
                  estado: true,
                  fechaVencimiento: true,
                },
              },
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

      return this.serializarCanasta(canastaActualizada);
    });
  }

  private obtenerFechaActualArgentina(): string {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Argentina/Ushuaia',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const año = partes.find((parte) => parte.type === 'year')?.value;
    const mes = partes.find((parte) => parte.type === 'month')?.value;
    const dia = partes.find((parte) => parte.type === 'day')?.value;

    if (!año || !mes || !dia) {
      throw new Error(
        'No se pudo determinar la fecha actual de Argentina.',
      );
    }

    return `${año}-${mes}-${dia}`;
  }

  private obtenerFechaProducto(fecha: Date): string {
    const año = fecha.getUTCFullYear();
    const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getUTCDate()).padStart(2, '0');

    return `${año}-${mes}-${dia}`;
  }

  private serializarCanasta(canasta: {
    idCanasta: string;
    comercioId: string;
    subtotal: unknown;
    comercio: {
      idComercio: string;
      nombreFantasia: string;
    } | null;
    items: Array<{
      idCanastaItem: string;
      productoId: string;
      cantidad: number;
      producto: {
        idProducto: string;
        titulo: string;
        imagen: string;
        stock: number;
        precioMenorcost: unknown;
        estado: string;
        fechaVencimiento: Date;
      };
    }>;
  }) {
    const items = canasta.items.map((item) => {
      const precioUnitario = Number(item.producto.precioMenorcost);

      return {
        idCanastaItem: item.idCanastaItem,
        productoId: item.productoId,
        cantidad: item.cantidad,
        precioUnitario: precioUnitario.toFixed(2),
        subtotal: (precioUnitario * item.cantidad).toFixed(2),
        producto: {
          ...item.producto,
          precioMenorcost: precioUnitario.toFixed(2),
          fechaVencimiento: this.obtenerFechaProducto(
            item.producto.fechaVencimiento,
          ),
        },
      };
    });

    const subtotal = items.reduce(
      (total, item) => total + Number(item.subtotal),
      0,
    );

    return {
      idCanasta: canasta.idCanasta,
      comercioId: canasta.comercioId,
      comercio: canasta.comercio,
      subtotal: subtotal.toFixed(2),
      items,
    };
  }
}