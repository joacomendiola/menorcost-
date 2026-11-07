import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service.js';
import { todayInArgentina } from './ofertas-rules.js';

@Injectable()
export class OffersExpirationService {
  private readonly logger = new Logger(OffersExpirationService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 0 * * *', {
    timeZone: 'America/Argentina/Ushuaia',
  })
  async expireOffersAutomatically(): Promise<void> {
    await this.expireOffers();
  }

  async expireOffers(now = new Date()): Promise<number> {
    const today = todayInArgentina(now);
    const expirationDate = new Date(`${today}T00:00:00.000Z`);

    const offers = await this.prisma.producto.findMany({
      where: {
        estado: 'ACTIVO',
        fechaVencimiento: {
          lte: expirationDate,
        },
      },
      select: {
        idProducto: true,
        comercioId: true,
        titulo: true,
        fechaVencimiento: true,
        comercio: {
          select: {
            userId: true,
          },
        },
      },
    });

    let expiredCount = 0;

    for (const offer of offers) {
      const wasExpired = await this.prisma.$transaction(async (transaction) => {
        const updateResult = await transaction.producto.updateMany({
          where: {
            idProducto: offer.idProducto,
            estado: 'ACTIVO',
          },
          data: {
            estado: 'VENCIDO_ELIMINADO',
          },
        });

        if (updateResult.count === 0) {
          return false;
        }

        const audit = await transaction.auditoriaVencimientoOferta.create({
          data: {
            productoId: offer.idProducto,
            comercioId: offer.comercioId,
            estadoAnterior: 'ACTIVO',
            estadoNuevo: 'VENCIDO_ELIMINADO',
            fechaVencimiento: offer.fechaVencimiento,
          },
        });

        await transaction.notificacion.create({
          data: {
            usuarioId: offer.comercio.userId,
            auditoriaVencimientoId: audit.id,
            tipo: 'OFERTA_VENCIDA',
            titulo: 'Oferta vencida',
            mensaje: `La oferta "${offer.titulo}" fue retirada automáticamente por alcanzar su fecha de vencimiento.`,
          },
        });

        return true;
      });

      if (wasExpired) {
        expiredCount += 1;
      }
    }

    this.logger.log(`Se depuraron ${expiredCount} ofertas vencidas`);
    return expiredCount;
  }
}