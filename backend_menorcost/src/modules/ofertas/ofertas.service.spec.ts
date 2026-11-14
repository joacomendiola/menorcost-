import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateOfferDto } from './dto/create-oferta.dto.js';
import type { UpdateOfferDto } from './dto/update-oferta.dto.js';
import { ImageStorageService } from './image-store.service.js';
import type {
  OfferAccess,
  OfferCategories,
  OfferDetails,
  OfferImage,
  OfferRecord,
  OfferRepository,
  OfferReservations,
} from './ofertas-creation.ports.js';
import { OffersService } from './ofertas.service.js';
import type { SimuladorPreciosService } from '../simulador-precios/simulador-precios.service.js';

describe('OffersService', () => {
  let service: OffersService;
  let access: OfferAccess;
  let categories: OfferCategories;
  let repository: OfferRepository;
  let imageStorage: ImageStorageService;
  let reservations: OfferReservations;
  let simuladorPrecios: Pick<SimuladorPreciosService, 'calcular'>;

  const dto: CreateOfferDto = {
    tipo: 'INDIVIDUAL',
    comercioId: '11111111-1111-4111-8111-111111111111',
    categoriaId: '22222222-2222-4222-8222-222222222222',
    titulo: 'Yogur',
    descripcion: 'Pack de yogures',
    fechaVencimiento: '2099-12-31',
    stock: 5,
    precioLista: '100.00',
    precioBaseNeto: '75.00',
  };

  const image: OfferImage = {
    buffer: Buffer.from('fake image'),
    mimetype: 'image/webp',
  };

  const savedOffer: OfferRecord = {
    id: 'offer-1',
    imagen: '/uploads/test.webp',
    estado: 'ACTIVO',
  };

  const offerDetails: OfferDetails = {
    id: '33333333-3333-4333-8333-333333333333',
    comercioId: dto.comercioId,
    categoriaId: dto.categoriaId,
    tipo: 'INDIVIDUAL',
    titulo: 'Yogur',
    descripcion: 'Pack de yogures',
    fechaVencimiento: '2099-12-31',
    stock: 5,
    precioLista: '100.00',
    precioBaseNeto: '75.00',
    precioPublico: '88.24',
    comisionMenorcostTasaAplicada: '0.1000',
    tasaMpEstimadaAplicada: '0.0650',
    imagen: '/uploads/yogur.webp',
    estado: 'ACTIVO',
  };

  const pendingReservationsMessage =
    'Esta oferta no puede eliminarse porque existen reservas pendientes de entrega. Debe completar o gestionar los retiros antes de darla de baja.';

  beforeEach(() => {
    access = {
      assertCanPublish: vi.fn().mockResolvedValue(undefined),
      assertMercadoPagoLinked: vi.fn().mockResolvedValue(undefined),
    };

    categories = {
      assertExists: vi.fn().mockResolvedValue(undefined),
    };

    repository = {
      create: vi.fn().mockResolvedValue(savedOffer),
      listByOwner: vi.fn().mockResolvedValue([offerDetails]),
      findByIdForOwner: vi.fn().mockResolvedValue(offerDetails),
      updateForOwner: vi.fn().mockResolvedValue(offerDetails),
      updateStatusForOwner: vi.fn().mockResolvedValue(offerDetails),
    };

    imageStorage = new ImageStorageService();
    vi.spyOn(imageStorage, 'save').mockResolvedValue('/uploads/test.webp');
    vi.spyOn(imageStorage, 'delete').mockResolvedValue();

    reservations = {
      getReservedUnitsForOffer: vi.fn().mockResolvedValue(0),
      getReservedUnitsForOwner: vi.fn().mockResolvedValue(0),
    };

    simuladorPrecios = {
      calcular: vi.fn().mockResolvedValue({
        precioBaseNeto: '75.00',
        comisionMenorcostTasa: '0.1000',
        comisionMenorcostMonto: '7.50',
        tasaMpEstimada: '0.0650',
        comisionMpEstimada: '5.57',
        precioPublico: '88.24',
        netoEstimadoComerciante: '75.17',
        advertenciaNeto: '',
      }),
    };

    service = new OffersService(
      access,
      categories,
      repository,
      imageStorage,
      reservations,
      simuladorPrecios,
    );
  });

  it('no guarda la imagen si Mercado Pago no está vinculado', async () => {
    vi.mocked(access.assertMercadoPagoLinked).mockRejectedValueOnce(
      new ForbiddenException(),
    );

    await expect(service.create('user-1', dto, image)).rejects.toThrow(
      ForbiddenException,
    );

    expect(imageStorage.save).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('no guarda la imagen si la categoría no existe', async () => {
    vi.mocked(categories.assertExists).mockRejectedValueOnce(
      new Error('Categoría inexistente'),
    );

    await expect(service.create('user-1', dto, image)).rejects.toThrow(
      'Categoría inexistente',
    );

    expect(imageStorage.save).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rechaza un vencimiento pasado antes de guardar la imagen', async () => {
    const invalidDto = { ...dto, fechaVencimiento: '2020-01-01' };

    await expect(service.create('user-1', invalidDto, image)).rejects.toThrow(
      'La fecha de caducidad debe ser posterior a la fecha actual',
    );

    expect(imageStorage.save).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rechaza un precio público igual o superior al precio de lista', async () => {
    const invalidDto = {
      ...dto,
      precioLista: '80.00',
    };
  
    await expect(
      service.create('user-1', invalidDto, image),
    ).rejects.toThrow(
      'El precio público debe ser menor que el precio de lista',
    );
  
    expect(imageStorage.save).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('crea la oferta activa con la referencia de imagen', async () => {
    await expect(service.create('user-1', dto, image)).resolves.toEqual(
      savedOffer,
    );

    expect(access.assertCanPublish).toHaveBeenCalledWith(
      'user-1',
      dto.comercioId,
    );
    expect(access.assertMercadoPagoLinked).toHaveBeenCalledWith(
      'user-1',
      dto.comercioId,
    );
    expect(categories.assertExists).toHaveBeenCalledWith(dto.categoriaId);
    expect(imageStorage.save).toHaveBeenCalledWith(image.buffer, image.mimetype);
    expect(repository.create).toHaveBeenCalledWith({
      ...dto,
      precioBaseNeto: '75.00',
      precioPublico: '88.24',
      comisionMenorcostTasaAplicada: '0.1000',
      tasaMpEstimadaAplicada: '0.0650',
      imagen: '/uploads/test.webp',
      estado: 'ACTIVO',
    });
  });

  it('no guarda la imagen si el usuario no puede publicar', async () => {
    vi.mocked(access.assertCanPublish).mockRejectedValueOnce(
      new ForbiddenException(),
    );

    await expect(service.create('user-1', dto, image)).rejects.toThrow(
      ForbiddenException,
    );

    expect(imageStorage.save).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('elimina la imagen si falla la persistencia y propaga el error', async () => {
    const databaseError = new Error('Database unavailable');
    vi.mocked(repository.create).mockRejectedValueOnce(databaseError);

    await expect(service.create('user-1', dto, image)).rejects.toBe(
      databaseError,
    );

    expect(imageStorage.delete).toHaveBeenCalledWith('/uploads/test.webp');
  });

  it('lista las ofertas del comerciante', async () => {
    await expect(service.listByOwner('user-1')).resolves.toEqual([
      offerDetails,
    ]);

    expect(repository.listByOwner).toHaveBeenCalledWith('user-1');
  });

  it('calcula las métricas del panel para las ofertas del comerciante', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-29T15:00:00.000Z'));

  try {
    const offers: OfferDetails[] = [
      {
        ...offerDetails,
        id: 'offer-active-today',
        estado: 'ACTIVO',
        fechaVencimiento: '2026-10-29',
        stock: 0,
      },
      {
        ...offerDetails,
        id: 'offer-paused-day-seven',
        estado: 'PAUSADO',
        fechaVencimiento: '2026-11-05',
        stock: 0,
      },
      {
        ...offerDetails,
        id: 'offer-active-day-eight',
        estado: 'ACTIVO',
        fechaVencimiento: '2026-11-06',
        stock: 0,
      },
      {
        ...offerDetails,
        id: 'offer-expired',
        estado: 'VENCIDO_ELIMINADO',
        fechaVencimiento: '2026-10-28',
        stock: 0,
      },
      {
        ...offerDetails,
        id: 'offer-manually-deleted',
        estado: 'ELIMINADO',
        fechaVencimiento: '2026-10-30',
        stock: 0,
      },
      {
        ...offerDetails,
        id: 'offer-active-past-date',
        estado: 'ACTIVO',
        fechaVencimiento: '2026-10-28',
        stock: 0,
      },
    ];

    vi.mocked(repository.listByOwner).mockResolvedValueOnce(offers);
    vi.mocked(reservations.getReservedUnitsForOwner).mockResolvedValueOnce(12);

    await expect(service.getDashboardSummary('user-1')).resolves.toEqual({
      total: 6,
      activas: 3,
      pausadas: 1,
      proximasAVencer: 2,
      vencidas: 1,
      sinStock: 5,
      unidadesReservadas: 12,
    });

    expect(repository.listByOwner).toHaveBeenCalledWith('user-1');
    expect(reservations.getReservedUnitsForOwner).toHaveBeenCalledWith(
      'user-1',
    );
  } finally {
    vi.useRealTimers();
  }
  });

  it('propaga el error si falla la consulta de unidades reservadas del comerciante', async () => {
    const reservationsError = new Error(
      'No se pudieron consultar las unidades reservadas',
    );

    vi.mocked(reservations.getReservedUnitsForOwner).mockRejectedValueOnce(
      reservationsError,
    );

    await expect(
      service.getDashboardSummary('user-1'),
    ).rejects.toBe(reservationsError);

    expect(repository.listByOwner).toHaveBeenCalledWith('user-1');
    expect(reservations.getReservedUnitsForOwner).toHaveBeenCalledWith(
      'user-1',
    );
  });

  it('devuelve una oferta propia por su identificador', async () => {
    await expect(
      service.getByIdForOwner('user-1', offerDetails.id),
    ).resolves.toEqual(offerDetails);

    expect(repository.findByIdForOwner).toHaveBeenCalledWith(
      'user-1',
      offerDetails.id,
    );
  });

  it('responde como no encontrada si no existe una oferta propia', async () => {
    vi.mocked(repository.findByIdForOwner).mockResolvedValueOnce(null);

    await expect(
      service.getByIdForOwner('user-1', offerDetails.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza una actualización sin ningún campo', async () => {
    await expect(
      service.update('user-1', offerDetails.id, {}),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.updateForOwner).not.toHaveBeenCalled();
  });

  it('rechaza un precio público que no sea inferior al precio de lista actual', async () => {
    const update: UpdateOfferDto = { precioLista: '70.00' };

    await expect(
      service.update('user-1', offerDetails.id, update),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.updateForOwner).not.toHaveBeenCalled();
  });

  it('actualiza los campos permitidos de la oferta', async () => {
  const update: UpdateOfferDto = {
    precioBaseNeto: '70.00',
    stock: 8,
  };
  const updatedOffer = {
    ...offerDetails,
    precioBaseNeto: '70.00',
    precioPublico: '82.90',
    stock: 8,
  };

    vi.mocked(repository.updateForOwner).mockResolvedValueOnce(updatedOffer);

    vi.mocked(simuladorPrecios.calcular).mockResolvedValueOnce({
      precioBaseNeto: '70.00',
      comisionMenorcostTasa: '0.1000',
      comisionMenorcostMonto: '7.00',
      tasaMpEstimada: '0.0650',
      comisionMpEstimada: '5.20',
      precioPublico: '82.90',
      netoEstimadoComerciante: '70.70',
      advertenciaNeto: '',
    });

    await expect(
      service.update('user-1', offerDetails.id, update),
    ).resolves.toEqual(updatedOffer);

    expect(repository.updateForOwner).toHaveBeenCalledWith(
      'user-1',
      offerDetails.id,
      {
        precioBaseNeto: '70.00',
        precioPublico: '82.90',
        comisionMenorcostTasaAplicada: '0.1000',
        tasaMpEstimadaAplicada: '0.0650',
        stock: 8,
      },
    );
    expect(reservations.getReservedUnitsForOffer).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
    expect(imageStorage.save).not.toHaveBeenCalled();
  });

  it('no modifica el stock si falla la consulta de reservas', async () => {
    const reservationsError = new Error('Consulta de reservas no disponible');
    vi.mocked(reservations.getReservedUnitsForOffer).mockRejectedValueOnce(
      reservationsError,
    );

    await expect(
      service.update('user-1', offerDetails.id, { stock: 4 }),
    ).rejects.toBe(reservationsError);

    expect(reservations.getReservedUnitsForOffer).toHaveBeenCalledWith(
      offerDetails.id,
    );
    expect(repository.updateForOwner).not.toHaveBeenCalled();
  });

  it('permite reducir el stock hasta la cantidad reservada', async () => {
    vi.mocked(reservations.getReservedUnitsForOffer).mockResolvedValueOnce(3);

    const updatedOffer = { ...offerDetails, stock: 3 };
    vi.mocked(repository.updateForOwner).mockResolvedValueOnce(updatedOffer);

    await expect(
      service.update('user-1', offerDetails.id, { stock: 3 }),
    ).resolves.toEqual(updatedOffer);

    expect(repository.updateForOwner).toHaveBeenCalledWith(
      'user-1',
      offerDetails.id,
      { stock: 3 },
    );
  });

  it('rechaza stock inferior a las unidades reservadas e informa el mínimo', async () => {
    vi.mocked(reservations.getReservedUnitsForOffer).mockResolvedValueOnce(3);

    const error = await service
      .update('user-1', offerDetails.id, { stock: 2 })
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(BadRequestException);

    if (error instanceof BadRequestException) {
      expect(error.getResponse()).toMatchObject({
        message:
          'El stock no puede ser inferior a las unidades que ya fueron reservadas por los clientes',
        minimumStock: 3,
      });
    }

    expect(repository.updateForOwner).not.toHaveBeenCalled();
  });

  it('pausa una oferta activa sin consultar reservas ni alterarlas', async () => {
    const pausedOffer = { ...offerDetails, estado: 'PAUSADO' as const };
    vi.mocked(repository.updateStatusForOwner).mockResolvedValueOnce(
      pausedOffer,
    );

    await expect(
      service.updateStatus('user-1', offerDetails.id, 'PAUSADO'),
    ).resolves.toEqual(pausedOffer);

    expect(repository.updateStatusForOwner).toHaveBeenCalledWith(
      'user-1',
      offerDetails.id,
      'PAUSADO',
    );
    expect(reservations.getReservedUnitsForOffer).not.toHaveBeenCalled();
  });

  it('reactiva una oferta pausada', async () => {
    const pausedOffer = { ...offerDetails, estado: 'PAUSADO' as const };
    const activeOffer = { ...offerDetails, estado: 'ACTIVO' as const };

    vi.mocked(repository.findByIdForOwner).mockResolvedValueOnce(pausedOffer);
    vi.mocked(repository.updateStatusForOwner).mockResolvedValueOnce(activeOffer);

    await expect(
      service.updateStatus('user-1', offerDetails.id, 'ACTIVO'),
    ).resolves.toEqual(activeOffer);

    expect(repository.updateStatusForOwner).toHaveBeenCalledWith(
      'user-1',
      offerDetails.id,
      'ACTIVO',
    );
    expect(reservations.getReservedUnitsForOffer).not.toHaveBeenCalled();
  });

  it('marca como eliminada una oferta sin reservas pendientes', async () => {
    const deletedOffer = { ...offerDetails, estado: 'ELIMINADO' as const };
    vi.mocked(repository.updateStatusForOwner).mockResolvedValueOnce(
      deletedOffer,
    );

    await expect(
      service.updateStatus('user-1', offerDetails.id, 'ELIMINADO'),
    ).resolves.toEqual(deletedOffer);

    expect(reservations.getReservedUnitsForOffer).toHaveBeenCalledWith(
      offerDetails.id,
    );
    expect(repository.updateStatusForOwner).toHaveBeenCalledWith(
      'user-1',
      offerDetails.id,
      'ELIMINADO',
    );
  });

  it('pausa la oferta y rechaza la baja si existen reservas pendientes', async () => {
    const pausedOffer = { ...offerDetails, estado: 'PAUSADO' as const };
    vi.mocked(reservations.getReservedUnitsForOffer).mockResolvedValueOnce(2);
    vi.mocked(repository.updateStatusForOwner).mockResolvedValueOnce(
      pausedOffer,
    );

    const error = await service
      .updateStatus('user-1', offerDetails.id, 'ELIMINADO')
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ConflictException);

    if (error instanceof ConflictException) {
      expect(error.getResponse()).toMatchObject({
        message: pendingReservationsMessage,
      });
    }

    expect(repository.updateStatusForOwner).toHaveBeenCalledTimes(1);
    expect(repository.updateStatusForOwner).toHaveBeenCalledWith(
      'user-1',
      offerDetails.id,
      'PAUSADO',
    );
  });

  it('no cambia el estado si falla la consulta de reservas al eliminar', async () => {
    vi.mocked(reservations.getReservedUnitsForOffer).mockRejectedValueOnce(
      new ServiceUnavailableException('Consulta de reservas no disponible'),
    );

    await expect(
      service.updateStatus('user-1', offerDetails.id, 'ELIMINADO'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(repository.updateStatusForOwner).not.toHaveBeenCalled();
  });

  it('no escribe si se solicita activar una oferta que ya está activa', async () => {
    await expect(
      service.updateStatus('user-1', offerDetails.id, 'ACTIVO'),
    ).resolves.toEqual(offerDetails);

    expect(repository.updateStatusForOwner).not.toHaveBeenCalled();
    expect(reservations.getReservedUnitsForOffer).not.toHaveBeenCalled();
  });

  it('devuelve la oferta sin escribir si se solicita el mismo estado', async () => {
    await expect(
      service.updateStatus('user-1', offerDetails.id, 'ACTIVO'),
    ).resolves.toEqual(offerDetails);

    expect(repository.updateStatusForOwner).not.toHaveBeenCalled();
    expect(reservations.getReservedUnitsForOffer).not.toHaveBeenCalled();
  });

  it('no permite cambiar el estado de una oferta ya eliminada', async () => {
    const deletedOffer = { ...offerDetails, estado: 'ELIMINADO' as const };
    vi.mocked(repository.findByIdForOwner).mockResolvedValueOnce(deletedOffer);

    await expect(
      service.updateStatus('user-1', offerDetails.id, 'PAUSADO'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(repository.updateStatusForOwner).not.toHaveBeenCalled();
  });

  it('reemplaza la imagen solo después de guardar la nueva referencia', async () => {
    const updatedOffer = {
      ...offerDetails,
      imagen: '/uploads/nueva-imagen.webp',
    };

    vi.mocked(imageStorage.save).mockResolvedValueOnce(
      '/uploads/nueva-imagen.webp',
    );
    vi.mocked(repository.updateForOwner).mockResolvedValueOnce(updatedOffer);

    await expect(
      service.update('user-1', offerDetails.id, {}, image),
    ).resolves.toEqual(updatedOffer);

    expect(repository.updateForOwner).toHaveBeenCalledWith(
      'user-1',
      offerDetails.id,
      { imagen: '/uploads/nueva-imagen.webp' },
    );
    expect(imageStorage.delete).toHaveBeenCalledWith(offerDetails.imagen);
  });

  it('limpia la nueva imagen y propaga el error si falla la persistencia', async () => {
    const databaseError = new Error('Database unavailable');

    vi.mocked(imageStorage.save).mockResolvedValueOnce(
      '/uploads/nueva-imagen.webp',
    );
    vi.mocked(repository.updateForOwner).mockRejectedValueOnce(databaseError);

    await expect(
      service.update('user-1', offerDetails.id, {}, image),
    ).rejects.toBe(databaseError);

    expect(imageStorage.delete).toHaveBeenCalledWith(
      '/uploads/nueva-imagen.webp',
    );
  });
});