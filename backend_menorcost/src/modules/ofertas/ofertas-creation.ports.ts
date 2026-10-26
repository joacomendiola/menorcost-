import type { CreateOfferDto } from './dto/create-oferta.dto.js';
import type { UpdateOfferDto } from './dto/update-oferta.dto.js';

export const OFFER_ACCESS = Symbol('OFFER_ACCESS');
export const OFFER_CATEGORIES = Symbol('OFFER_CATEGORIES');
export const OFFER_REPOSITORY = Symbol('OFFER_REPOSITORY');
export const OFFER_RESERVATIONS = Symbol('OFFER_RESERVATIONS');

export interface OfferAccess {
  assertCanPublish(userId: string, comercioId: string): Promise<void>;
  assertMercadoPagoLinked(
    userId: string,
    comercioId: string,
  ): Promise<void>;
}

export interface OfferReservations {
  getReservedUnitsForOffer(offerId: string): Promise<number>;
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

export interface OfferDetails {
  id: string;
  comercioId: string;
  categoriaId: string;
  tipo: 'INDIVIDUAL' | 'COMBO';
  titulo: string;
  descripcion: string;
  fechaVencimiento: string;
  stock: number;
  precioLista: string;
  precioMenorcost: string;
  imagen: string;
  estado: 'ACTIVO' | 'PAUSADO' | 'VENCIDO_ELIMINADO' | 'ELIMINADO';
}

export interface OfferRepository {
  create(
    data: CreateOfferDto & {
      imagen: string;
      estado: 'ACTIVO';
    },
  ): Promise<OfferRecord>;

  listByOwner(userId: string): Promise<OfferDetails[]>;

  findByIdForOwner(
    userId: string,
    offerId: string,
  ): Promise<OfferDetails | null>;

  updateForOwner(
    userId: string,
    offerId: string,
    data: UpdateOfferDto & { imagen?: string },
  ): Promise<OfferDetails | null>;
}