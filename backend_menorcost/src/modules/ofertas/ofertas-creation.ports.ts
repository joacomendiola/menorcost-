import type { CreateOfferDto } from './dto/create-offer.dto.js';

export const OFFER_ACCESS = Symbol('OFFER_ACCESS');
export const OFFER_CATEGORIES = Symbol('OFFER_CATEGORIES');
export const OFFER_REPOSITORY = Symbol('OFFER_REPOSITORY');

export interface OfferAccess {
  assertCanPublish(userId: string, comercioId: string): Promise<void>;
  assertMercadoPagoLinked(
    userId: string,
    comercioId: string,
  ): Promise<void>;
}

export interface OfferCategories {
  assertExists(categoriaId: string): Promise<void>;
}

export interface OfferImage {
  buffer: Buffer;
  mimetype: string;
}

export interface OfferRecord {
  id: string;
  imagen: string;
  estado: 'ACTIVO';
}

export interface OfferRepository {
  create(
    data: CreateOfferDto & {
      imagen: string;
      estado: 'ACTIVO';
    },
  ): Promise<OfferRecord>;
}