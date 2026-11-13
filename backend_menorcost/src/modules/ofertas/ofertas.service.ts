import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  OFFER_ACCESS,
  OFFER_CATEGORIES,
  OFFER_REPOSITORY,
  OFFER_RESERVATIONS,
} from './ofertas-creation.ports.js';
import type {
  CalculatedOfferPrices,
  ManageableOfferStatus,
  OfferAccess,
  OfferCategories,
  OfferDashboardSummary,
  OfferDetails,
  OfferImage,
  OfferRecord,
  OfferRepository,
  OfferReservations,
} from './ofertas-creation.ports.js';
import { CreateOfferDto } from './dto/create-oferta.dto.js';
import type { UpdateOfferDto } from './dto/update-oferta.dto.js';
import { ImageStorageService } from './image-store.service.js';
import {
  todayInArgentina,
  validateOfferRules,
  validatePublicPrice,
} from './ofertas-rules.js';
import { SimuladorPreciosService } from '../simulador-precios/simulador-precios.service.js';

type PriceCalculator = Pick<SimuladorPreciosService, 'calcular'>;

const OFFER_HAS_PENDING_RESERVATIONS =
  'Esta oferta no puede eliminarse porque existen reservas pendientes de entrega. Debe completar o gestionar los retiros antes de darla de baja.';

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
    @Inject(ImageStorageService)
    private readonly imageStorage: ImageStorageService,
    @Inject(OFFER_RESERVATIONS)
    private readonly reservations: OfferReservations,
    @Inject(SimuladorPreciosService)
    private readonly simuladorPrecios: PriceCalculator,
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

    const calculo = await this.simuladorPrecios.calcular({
      precioLista: dto.precioLista,
      precioBaseNeto: dto.precioBaseNeto,
    });

    validatePublicPrice(
      dto.precioLista,
      calculo.precioPublico,
    );

    const imageUrl = await this.imageStorage.save(
      image.buffer,
      image.mimetype,
    );

    try {
      return await this.repository.create({
        ...dto,
        precioBaseNeto: calculo.precioBaseNeto,
        precioPublico: calculo.precioPublico,
        comisionMenorcostTasaAplicada:
          calculo.comisionMenorcostTasa,
        tasaMpEstimadaAplicada: calculo.tasaMpEstimada,
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

  async getDashboardSummary(
    userId: string,
  ): Promise<OfferDashboardSummary> {
    const [offers, unidadesReservadas] = await Promise.all([
      this.repository.listByOwner(userId),
      this.reservations.getReservedUnitsForOwner(userId),
    ]);

    const hoy = todayInArgentina(new Date());
    const [year, month, day] = hoy.split('-').map(Number);
    const limiteVencimiento = new Date(
      Date.UTC(year, month - 1, day + 7),
    )
      .toISOString()
      .slice(0, 10);

    return {
      total: offers.length,
      activas: offers.filter((offer) => offer.estado === 'ACTIVO').length,
      pausadas: offers.filter((offer) => offer.estado === 'PAUSADO').length,
      proximasAVencer: offers.filter(
        (offer) =>
          (offer.estado === 'ACTIVO' || offer.estado === 'PAUSADO') &&
          offer.fechaVencimiento >= hoy &&
          offer.fechaVencimiento <= limiteVencimiento,
      ).length,
      vencidas: offers.filter(
        (offer) => offer.estado === 'VENCIDO_ELIMINADO',
      ).length,
      sinStock: offers.filter(
        (offer) => offer.stock === 0 && offer.estado !== 'ELIMINADO',
      ).length,
      unidadesReservadas,
    };
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
      dto.precioBaseNeto === undefined &&
      dto.stock === undefined &&
      image === undefined
    ) {
      throw new BadRequestException(
        'Debes indicar al menos un dato para modificar',
      );
    }

    const cambiaPrecio =
      dto.precioLista !== undefined ||
      dto.precioBaseNeto !== undefined;

    let preciosCalculados: Partial<CalculatedOfferPrices> = {};

    if (cambiaPrecio) {
      const calculo = await this.simuladorPrecios.calcular({
        precioLista: dto.precioLista ?? current.precioLista,
        precioBaseNeto:
          dto.precioBaseNeto ?? current.precioBaseNeto,
      });

      const precioLista =
        dto.precioLista ?? current.precioLista;

      validatePublicPrice(
        precioLista,
        calculo.precioPublico,
      );

      preciosCalculados = {
        precioBaseNeto: calculo.precioBaseNeto,
        precioPublico: calculo.precioPublico,
        comisionMenorcostTasaAplicada:
          calculo.comisionMenorcostTasa,
        tasaMpEstimadaAplicada: calculo.tasaMpEstimada,
      };
    }

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
        ...(dto.precioLista !== undefined
          ? { precioLista: dto.precioLista }
          : {}),
        ...(dto.stock !== undefined ? { stock: dto.stock } : {}),
        ...preciosCalculados,
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

  async updateStatus(
    userId: string,
    offerId: string,
    estado: ManageableOfferStatus,
  ): Promise<OfferDetails> {
    const current = await this.getByIdForOwner(userId, offerId);

    if (
      current.estado === 'ELIMINADO' ||
      current.estado === 'VENCIDO_ELIMINADO'
    ) {
      throw new ConflictException(
        'No se puede cambiar el estado de una oferta eliminada',
      );
    }

    if (current.estado === estado) {
      return current;
    }

    if (estado === 'ACTIVO' && current.estado !== 'PAUSADO') {
      throw new ConflictException(
        'Solo se puede reactivar una oferta pausada',
      );
    }

    if (estado === 'ELIMINADO') {
      const reservedUnits =
        await this.reservations.getReservedUnitsForOffer(offerId);

      if (reservedUnits > 0) {
        if (current.estado !== 'PAUSADO') {
          const paused = await this.repository.updateStatusForOwner(
            userId,
            offerId,
            'PAUSADO',
          );

          if (!paused) {
            throw new NotFoundException('Oferta no encontrada');
          }
        }

        throw new ConflictException(OFFER_HAS_PENDING_RESERVATIONS);
      }
    }

    const updated = await this.repository.updateStatusForOwner(
      userId,
      offerId,
      estado,
    );

    if (!updated) {
      throw new NotFoundException('Oferta no encontrada');
    }

    return updated;
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