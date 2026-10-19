import {
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  OFFER_ACCESS,
  OFFER_CATEGORIES,
  OFFER_REPOSITORY,
  type OfferAccess,
  type OfferCategories,
  type OfferImage,
  type OfferRecord,
  type OfferRepository,
} from './offer-creation.ports.js';
import { CreateOfferDto } from './dto/create-offer.dto.js';
import { ImageStorageService } from './image-store.service.js';
import { validateOfferRules } from './offer-rules.js';

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
  ) {}

  async create(
    userId: string,
    dto: CreateOfferDto,
    image: OfferImage,
  ): Promise<OfferRecord> {
    await this.access.assertCanPublish(userId, dto.comercioId);
    await this.access.assertMercadoPagoLinked(userId);
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
      try {
        await this.imageStorage.delete(imageUrl);
      } catch (cleanupError) {
        this.logger.error(
          `No se pudo limpiar la imagen de una oferta que no se guardó: ${imageUrl}`,
          cleanupError,
        );
      }

      throw error;
    }
  }
}