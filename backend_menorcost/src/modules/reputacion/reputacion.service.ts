import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js'; 

@Injectable()
export class ReputacionService {
  constructor(private prisma: PrismaService) {}

  async recalcularReputacionComercio(id_comercio: string) {
    return this.prisma.$transaction(async (tx) => {
      // Agrupación de calificaciones asociadas a los pedidos entregados de este comercio
      const agregacion = await tx.calificacion.aggregate({
        _avg: { puntaje: true },
        _count: { id_calificacion: true },
        where: {
          // Nota: Ajustar "comercioId" y "estado" cuando el Dev 4 suba el modelo Pedido definitivo
          pedido: { /* comercioId: id_comercio, estado: 'ENTREGADO' */ } as any, 
        },
      });

      const promedioOriginal = agregacion._avg.puntaje || 0;
      const promedioRedondeado = Math.round(promedioOriginal * 10) / 10;
      const totalCalificaciones = agregacion._count.id_calificacion || 0;

      // Actualización de la caché en el modelo Comercio (dev 2)
      await tx.comercio.update({
        where: { idComercio: id_comercio },
        data: {
          // reputacionPromedio: promedioRedondeado,
          // totalCalificaciones: totalCalificaciones,
        } as any, // Quitar el "as any" cuando Dev 2 agregue los campos en schema.prisma
      });

      return { promedio: promedioRedondeado, total: totalCalificaciones };
    });
  }

  async obtenerReputacionComercio(id_comercio: string) {
    const calificaciones = await this.prisma.calificacion.findMany({
      where: {
        // Nota: Ajustar cuando el Dev 4 suba el modelo Pedido definitivo
        pedido: { /* comercioId: id_comercio, estado: 'ENTREGADO' */ } as any,
      },
      include: {
        pedido: {
          // include: { usuario: true }, // Descomentar cuando Pedido tenga la relación con Usuario
        },
      },
      orderBy: { fecha_creacion: 'desc' },
    });

    const distribucion: Record<string, number> = { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 };
    let sumaPuntajes = 0;

    const resenas = calificaciones.map((cal) => {
      distribucion[cal.puntaje.toString()] += 1;
      sumaPuntajes += cal.puntaje;

      //temporal hasta que Dev 4 integre el modelo Usuario dentro de Pedido
      const cliente = (cal.pedido as any)?.usuario || { nombre: 'Cliente', apellido: 'Anónimo' };

      return {
        id: cal.id_calificacion,
        clienteNombre: `${cliente.nombre} ${cliente.apellido}`,
        fecha: cal.fecha_creacion.toISOString(),
        puntaje: cal.puntaje,
        comentario: cal.comentario || '',
      };
    });

    const totalResenas = calificaciones.length;
    const promedio = totalResenas > 0 ? Math.round((sumaPuntajes / totalResenas) * 10) / 10 : 0;

    return {
      promedio,
      totalResenas,
      distribucion,
      resenas,
    };
  }
}