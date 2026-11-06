import {
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class DetalleOfertaPublicaService {
  constructor(private readonly prisma: PrismaService) {}

  async obtener(comercioId: string, productoId: string) {
    const comercio = await this.prisma.comercio.findFirst({
      where: {
        idComercio: comercioId,
        estado: 'HABILITADO',
      },
      select: {
        idComercio: true,
        nombreFantasia: true,
        latitud: true,
        longitud: true,
        calle: true,
        numero: true,
        localidad: true,
        provincia: true,
      },
    });

    if (!comercio) {
      throw new NotFoundException('La tienda no está disponible.');
    }

    const producto = await this.prisma.producto.findFirst({
      where: {
        idProducto: productoId,
        comercioId,
      },
      select: {
        idProducto: true,
        titulo: true,
        descripcion: true,
        imagen: true,
        precioLista: true,
        precioMenorcost: true,
        fechaVencimiento: true,
        stock: true,
        estado: true,
        categoria: {
          select: {
            nombre: true,
            slug: true,
          },
        },
      },
    });

    if (!producto) {
      throw new NotFoundException('La oferta no existe.');
    }

    const fechaActual = this.obtenerFechaActualArgentina();
    const fechaVencimiento = this.obtenerFechaProducto(
      producto.fechaVencimiento,
    );

    if (
      producto.estado === 'VENCIDO_ELIMINADO' ||
      fechaVencimiento < fechaActual
    ) {
      throw new GoneException('El producto está vencido.');
    }

    if (producto.estado !== 'ACTIVO') {
      throw new NotFoundException('La oferta no está disponible.');
    }

    return {
      producto: {
        id: producto.idProducto,
        titulo: producto.titulo,
        descripcion: producto.descripcion,
        imagen: producto.imagen,
        precioLista: Number(producto.precioLista).toFixed(2),
        precioMenorcost: Number(producto.precioMenorcost).toFixed(2),
        fechaVencimiento,
        stock: producto.stock,
        categoria: producto.categoria,
      },
      comercio: {
        id: comercio.idComercio,
        nombreFantasia: comercio.nombreFantasia,
        latitud: Number(comercio.latitud),
        longitud: Number(comercio.longitud),
        calle: comercio.calle,
        numero: comercio.numero,
        localidad: comercio.localidad,
        provincia: comercio.provincia,
      },
    };
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
}