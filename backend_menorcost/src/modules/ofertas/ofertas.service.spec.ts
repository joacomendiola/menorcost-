import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateOfferDto } from './dto/create-oferta.dto.js';
import type {
  OfferAccess,
  OfferCategories,
  OfferImage,
  OfferRecord,
  OfferRepository,
} from './ofertas-creation.ports.js';
import { ImageStorageService } from './image-store.service.js';
import { OffersService } from './ofertas.service.js';

describe('OffersService', () => {
  let service: OffersService;
  let access: OfferAccess;
  let categories: OfferCategories;
  let repository: OfferRepository;
  let imageStorage: ImageStorageService;

  const dto: CreateOfferDto = {
    tipo: 'INDIVIDUAL',
    comercioId: '11111111-1111-4111-8111-111111111111',
    categoriaId: '22222222-2222-4222-8222-222222222222',
    titulo: 'Yogur',
    descripcion: 'Pack de yogures',
    fechaVencimiento: '2099-12-31',
    stock: 5,
    precioLista: '100.00',
    precioMenorcost: '75.00',
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
      listByOwner: vi.fn(),
      findByIdForOwner: vi.fn(),
      updateForOwner: vi.fn(),
    };

    imageStorage = new ImageStorageService();
    vi.spyOn(imageStorage, 'save').mockResolvedValue('/uploads/test.webp');
    vi.spyOn(imageStorage, 'delete').mockResolvedValue();

    service = new OffersService(access, categories, repository, imageStorage);
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

    it('rechaza el precio promocional igual al precio de lista', async () => {
  const invalidDto = { ...dto, precioMenorcost: dto.precioLista };

  await expect(service.create('user-1', invalidDto, image)).rejects.toThrow(
    'El precio promocional debe ofrecer un descuento real',
  );

  expect(imageStorage.save).not.toHaveBeenCalled();
  expect(repository.create).not.toHaveBeenCalled();
    });

  it('crea la oferta activa con la referencia de imagen', async () => {
    await expect(service.create('user-1', dto, image)).resolves.toEqual(savedOffer);

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
});