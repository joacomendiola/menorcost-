import { Module, ServiceUnavailableException } from '@nestjs/common';
import {
  OFFER_ACCESS,
  OFFER_CATEGORIES,
  OFFER_REPOSITORY,
  type OfferAccess,
  type OfferCategories,
  type OfferRepository,
} from './offer-creation.ports.js';
import { OffersController } from './offers.controller.js';
import { OffersService } from './offers.service.js';
import { ImageStorageService } from './image-store.service.js';

function notIntegrated(): ServiceUnavailableException {
  return new ServiceUnavailableException(
    'La creación de ofertas todavía no está integrada con los módulos requeridos',
  );
}

// TODO integración: reemplazar este adaptador por los servicios reales de
// autenticación, estado del comerciante, pertenencia del comercio y Mercado Pago.
// No cambiarlo por métodos que siempre autoricen.
const offerAccessUnavailable: OfferAccess = {
  async assertCanPublish(_userId, _comercioId) {
    throw notIntegrated();
  },
  async assertMercadoPagoLinked(_userId) {
    throw notIntegrated();
  },
};

// TODO integración: reemplazar por el servicio/repositorio real de categorías,
// que debe comprobar que categoriaId existe y está disponible.
const offerCategoriesUnavailable: OfferCategories = {
  async assertExists(_categoriaId) {
    throw notIntegrated();
  },
};

// TODO integración: reemplazar por el repositorio Prisma real.
// Debe crear Producto y devolver el registro persistido.
const offerRepositoryUnavailable: OfferRepository = {
  async create(_data) {
    throw notIntegrated();
  },
};

@Module({
  controllers: [OffersController],
  providers: [
    OffersService,
    ImageStorageService,

    // TODO integración: vincular OFFER_ACCESS con el adaptador real de acceso.
    { provide: OFFER_ACCESS, useValue: offerAccessUnavailable },

    // TODO integración: vincular OFFER_CATEGORIES con el servicio de categorías.
    { provide: OFFER_CATEGORIES, useValue: offerCategoriesUnavailable },

    // TODO integración: vincular OFFER_REPOSITORY con el repositorio Prisma.
    { provide: OFFER_REPOSITORY, useValue: offerRepositoryUnavailable },
  ],
})
export class OffersModule {}