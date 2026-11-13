import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { calcularDistanciaKm } from './distancia.js';
import type { BuscarCatalogoDto, BuscarComerciosDto } from './dto/buscar-catalogo.dto.js';

@Injectable()
export class CatalogoService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtros: BuscarCatalogoDto) {
    if ((filtros.latitud === undefined) !== (filtros.longitud === undefined)) {
      throw new BadRequestException('Se requieren latitud y longitud juntas');
    }
    if (filtros.precioMin !== undefined && filtros.precioMax !== undefined && filtros.precioMin > filtros.precioMax) {
      throw new BadRequestException('El precio mínimo no puede superar al máximo');
    }
    const productos = await this.prisma.producto.findMany({
      where: {
        estado: 'ACTIVO', fechaVencimiento: { gte: new Date(new Date().toDateString()) },
        categoriaId: filtros.categoriaId,
        precioPublico: { gte: filtros.precioMin, lte: filtros.precioMax },
        OR: filtros.q?.trim() ? [
          { titulo: { contains: filtros.q.trim(), mode: 'insensitive' } },
          { descripcion: { contains: filtros.q.trim(), mode: 'insensitive' } },
        ] : undefined,
        comercio: { estado: 'HABILITADO', abierto: filtros.abierto === true ? true : undefined },
      },
      include: { categoria: { select: { nombre: true, slug: true } }, comercio: { select: {
        idComercio: true, nombreFantasia: true, localidad: true, logoUrl: true, abierto: true, latitud: true, longitud: true,
      } } },
      orderBy: [{ fechaVencimiento: 'asc' }, { titulo: 'asc' }],
    });
    const resultados = productos.map(({ idProducto, comercio, ...producto }) => {
      const distanciaKm = filtros.latitud === undefined ? null : calcularDistanciaKm(
        filtros.latitud, filtros.longitud!, Number(comercio.latitud), Number(comercio.longitud),
      );
      return {
        id: idProducto,
        ...producto,
        comercio: { id: comercio.idComercio, ...comercio },
        distanciaKm,
      };
    }).filter((producto) => filtros.radioKm === undefined || (producto.distanciaKm !== null && producto.distanciaKm <= filtros.radioKm));
    if (filtros.latitud !== undefined) resultados.sort((a, b) => a.distanciaKm! - b.distanciaKm!);
    return resultados;
  }

  async buscarComercios({ q }: BuscarComerciosDto) {
    const texto = q.trim();
    if (!texto) throw new BadRequestException('Ingresá una palabra clave');
    const comercios = await this.prisma.comercio.findMany({
      where: { estado: 'HABILITADO', nombreFantasia: { contains: texto, mode: 'insensitive' }, productos: { some: { estado: 'ACTIVO', fechaVencimiento: { gte: new Date(new Date().toDateString()) } } } },
      select: { idComercio: true, nombreFantasia: true, descripcion: true, logoUrl: true, localidad: true, abierto: true },
      orderBy: { nombreFantasia: 'asc' }, take: 50,
    });
    return comercios.map(({ idComercio, ...comercio }) => ({ id: idComercio, ...comercio }));
  }
}
