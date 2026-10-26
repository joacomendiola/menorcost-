import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  OFFER_RESERVATIONS,
  OFFER_ACCESS,
  OFFER_CATEGORIES,
  OFFER_REPOSITORY,
  type OfferReservations,
  type OfferAccess,
  type OfferCategories,
  type OfferDetails,
  type OfferImage,
  type OfferRecord,
  type OfferRepository,
} from './ofertas-creation.ports.js';
import { CreateOfferDto } from './dto/create-oferta.dto.js';
import type { UpdateOfferDto } from './dto/update-oferta.dto.js';
import { ImageStorageService } from './image-store.service.js';
import { validateOfferRules } from './ofertas-rules.js';

@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(
    @Inject(OFFER_ACCESS)
    private readonly access: OfferAccess,
    @Inject(OFFER_CATEGORIES)
    private readonly categories: OfferCategories,
    @Inject(OFFER_REPOSITORY)
    private readonly repository: OfferRepository,
    private readonly imageStorage: ImageStorageService,
    @Inject(OFFER_RESERVATIONS)
    private readonly reservations: OfferReservations,
  ) {}

  async create(
    userId: string,
    dto: CreateOfferDto,
    image: OfferImage,
  ): Promise<OfferRecord> {
    await this.access.assertCanPublish(userId, dto.comercioId);
    await this.access.assertMercadoPagoLinked(userId, dto.comercioId);
    await this.categories.assertExists(dto.categoriaId);

    validateOfferRules(dto);

    const imageUrl = await this.imageStorage.save(
      image.buffer,
      image.mimetype,
    );

    try {
      return await this.repository.create({
        ...dto,
        imagen: imageUrl,
        estado: 'ACTIVO',
      });
    } catch (error) {
      await this.deleteImageAfterFailure(imageUrl, error);
      throw error;
    }
  }

  async listByOwner(userId: string): Promise<OfferDetails[]> {
    return this.repository.listByOwner(userId);
  }

  async getByIdForOwner(
    userId: string,
    offerId: string,
  ): Promise<OfferDetails> {
    const offer = await this.repository.findByIdForOwner(userId, offerId);

    if (!offer) {
      throw new NotFoundException('Oferta no encontrada');
    }

    return offer;
  }

  async update(
    userId: string,
    offerId: string,
    dto: UpdateOfferDto,
    image?: OfferImage,
  ): Promise<OfferDetails> {
    const current = await this.getByIdForOwner(userId, offerId);

    if (
      dto.precioLista === undefined &&
      dto.precioMenorcost === undefined &&
      dto.stock === undefined &&
      image === undefined
    ) {
      throw new BadRequestException(
        'Debes indicar al menos un dato para modificar',
      );
    }

    const precioLista = dto.precioLista ?? current.precioLista;
    const precioMenorcost = dto.precioMenorcost ?? current.precioMenorcost;
    this.validatePrices(precioLista, precioMenorcost);

    if (dto.stock !== undefined && dto.stock < current.stock) {
      const reservedUnits = await this.reservations.getReservedUnitsForOffer(
        offerId,
      );

      if (dto.stock < reservedUnits) {
        throw new BadRequestException({
          message:
            'El stock no puede ser inferior a las unidades que ya fueron reservadas por los clientes',
          minimumStock: reservedUnits,
        });
      }
    }

    const newImageUrl = image
      ? await this.imageStorage.save(image.buffer, image.mimetype)
      : undefined;

    let updated: OfferDetails | null;

    try {
      updated = await this.repository.updateForOwner(userId, offerId, {
        ...dto,
        ...(newImageUrl ? { imagen: newImageUrl } : {}),
      });
    } catch (error) {
      if (newImageUrl) {
        await this.deleteImageAfterFailure(newImageUrl, error);
      }
      throw error;
    }

    if (!updated) {
      if (newImageUrl) {
        await this.deleteImageAfterFailure(
          newImageUrl,
          new NotFoundException('Oferta no encontrada'),
        );
      }
      throw new NotFoundException('Oferta no encontrada');
    }

    if (newImageUrl && current.imagen !== newImageUrl) {
      try {
        await this.imageStorage.delete(current.imagen);
      } catch (error) {
        this.logger.error(
          `No se pudo eliminar la imagen anterior de la oferta ${offerId}`,
          error,
        );
      }
    }

    return updated;
  }

  private validatePrices(
    precioLista: string,
    precioMenorcost: string,
  ): void {
    const listaEnCentavos = this.toCents(precioLista);
    const promoEnCentavos = this.toCents(precioMenorcost);

    if (listaEnCentavos <= 0n || promoEnCentavos <= 0n) {
      throw new BadRequestException('Los precios deben ser mayores que cero');
    }

    if (promoEnCentavos >= listaEnCentavos) {
      throw new BadRequestException(
        'El precio promocional debe ser menor que el precio de lista',
      );
    }
  }

  private toCents(value: string): bigint {
    if (!/^\d+(\.\d{1,2})?$/.test(value)) {
      throw new BadRequestException('El formato de precio no es válido');
    }

    const [whole, fraction = ''] = value.split('.');
    return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  }

  private async deleteImageAfterFailure(
    imageUrl: string,
    originalError: unknown,
  ): Promise<void> {
    try {
      await this.imageStorage.delete(imageUrl);
    } catch (cleanupError) {
      this.logger.error(
        `No se pudo limpiar la imagen luego de fallar la operación: ${imageUrl}`,
        cleanupError,
      );
      this.logger.error('Error original de la operación', originalError);
    }
  }
}