import { Module, ServiceUnavailableException } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import {
  OFFER_ACCESS,
  OFFER_CATEGORIES,
  OFFER_REPOSITORY,
  OFFER_RESERVATIONS,
  type OfferReservations,
} from './ofertas-creation.ports.js';
import { OffersController } from './ofertas.controller.js';
import { OffersService } from './ofertas.service.js';
import { ImageStorageService } from './image-store.service.js';
import {
  PrismaOfferAccessAdapter,
  PrismaOfferCategoriesAdapter,
  PrismaOfferRepositoryAdapter,
} from './prisma-ofertas.adapters.js';

@Module({
  imports: [AuthModule],
  controllers: [OffersController],
  providers: [
    OffersService,
    ImageStorageService,
    JwtAuthGuard,
    RolesGuard,
    PrismaOfferAccessAdapter,
    PrismaOfferCategoriesAdapter,
    PrismaOfferRepositoryAdapter,
    { provide: OFFER_ACCESS, useExisting: PrismaOfferAccessAdapter },
    { provide: OFFER_CATEGORIES, useExisting: PrismaOfferCategoriesAdapter },
    { provide: OFFER_REPOSITORY, useExisting: PrismaOfferRepositoryAdapter },
    {
        provide: OFFER_RESERVATIONS,
        useValue: {
          async getReservedUnitsForOffer(): Promise<number> {
            throw new ServiceUnavailableException(
              'La consulta de reservas PENDIENTE_RETIRO todavía no está integrada',
            );
          },
        } satisfies OfferReservations,
      },
  ],

})
export class OffersModule {}