import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { CreateOfferDto } from './dto/create-oferta.dto.js';
import { UpdateOfferDto } from './dto/update-oferta.dto.js';
import { UpdateOfertaStatusDto } from './dto/update-oferta-status.dto.js';
import type {
  OfferDetails,
  OfferRecord,
} from './ofertas-creation.ports.js';
import { OffersController } from './ofertas.controller.js';
import { OffersService } from './ofertas.service.js';

describe('OffersController', () => {
  let controller: OffersController;
  let createOffer: ReturnType<typeof vi.fn>;
  let listOffers: ReturnType<typeof vi.fn>;
  let getOffer: ReturnType<typeof vi.fn>;
  let updateOffer: ReturnType<typeof vi.fn>;
  let updateStatusOffer: ReturnType<typeof vi.fn>;
  let getDashboardSummary: ReturnType<typeof vi.fn>;

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

  const usuario: AuthenticatedUser = {
    id: 'user-1',
    email: 'comerciante@example.com',
    rol: 'COMERCIANTE',
    estado: 'HABILITADO',
  };

  const image = {
    buffer: Buffer.from('image'),
    mimetype: 'image/webp',
  } as Express.Multer.File;

  const offer: OfferRecord = {
    id: 'offer-1',
    imagen: '/uploads/test.webp',
    estado: 'ACTIVO',
  };

  const offerDetails: OfferDetails = {
    id: '11111111-1111-4111-8111-111111111111',
    comercioId: '22222222-2222-4222-8222-222222222222',
    categoriaId: '33333333-3333-4333-8333-333333333333',
    tipo: 'INDIVIDUAL',
    titulo: 'Yogur',
    descripcion: 'Pack de yogures',
    fechaVencimiento: '2099-12-31',
    stock: 5,
    precioLista: '100.00',
    precioMenorcost: '75.00',
    imagen: '/uploads/test.webp',
    estado: 'ACTIVO',
  };

  beforeEach(async () => {
    createOffer = vi.fn().mockResolvedValue(offer);
    listOffers = vi.fn().mockResolvedValue([offerDetails]);
    getOffer = vi.fn().mockResolvedValue(offerDetails);
    updateOffer = vi.fn().mockResolvedValue(offerDetails);
    updateStatusOffer = vi.fn().mockResolvedValue({
      ...offerDetails,
      estado: 'PAUSADO',
    });
    getDashboardSummary = vi.fn().mockResolvedValue({offerDetails});

    const moduleRef = await Test.createTestingModule({
      controllers: [OffersController],
      providers: [
        {
          provide: OffersService,
          useValue: {
            create: createOffer,
            listByOwner: listOffers,
            getByIdForOwner: getOffer,
            update: updateOffer,
            updateStatus: updateStatusOffer,
            getDashboardSummary: getDashboardSummary,
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(OffersController);
  });

  it('envía los datos, el usuario y la imagen al servicio al crear', async () => {
    await expect(controller.create(usuario, dto, image)).resolves.toEqual(
      offer,
    );

    expect(createOffer).toHaveBeenCalledWith('user-1', dto, {
      buffer: image.buffer,
      mimetype: image.mimetype,
    });
  });

  it('lista las ofertas del usuario autenticado', async () => {
    await expect(controller.list(usuario)).resolves.toEqual([offerDetails]);

    expect(listOffers).toHaveBeenCalledWith('user-1');
  });

  it('busca una oferta para el usuario autenticado', async () => {
    const offerId = offerDetails.id;

    await expect(controller.getById(usuario, offerId)).resolves.toEqual(
      offerDetails,
    );

    expect(getOffer).toHaveBeenCalledWith('user-1', offerId);
  });

  it('envía los cambios y la imagen opcional al servicio', async () => {
    const offerId = offerDetails.id;
    const updateDto: UpdateOfferDto = {
      precioMenorcost: '70.00',
      stock: 8,
    };

    await expect(
      controller.update(usuario, offerId, updateDto, image),
    ).resolves.toEqual(offerDetails);

    expect(updateOffer).toHaveBeenCalledWith('user-1', offerId, updateDto, {
      buffer: image.buffer,
      mimetype: image.mimetype,
    });
  });

  it('permite solicitar una actualización sin enviar imagen', async () => {
    const offerId = offerDetails.id;
    const updateDto: UpdateOfferDto = {
      precioMenorcost: '70.00',
    };

    await expect(
      controller.update(usuario, offerId, updateDto),
    ).resolves.toEqual(offerDetails);

    expect(updateOffer).toHaveBeenCalledWith(
      'user-1',
      offerId,
      updateDto,
      undefined,
    );
  });

  it('envía el estado solicitado y el usuario autenticado al servicio', async () => {
    const offerId = offerDetails.id;
    const statusDto: UpdateOfertaStatusDto = { estado: 'PAUSADO' };
    const pausedOffer = { ...offerDetails, estado: 'PAUSADO' as const };
    updateStatusOffer.mockResolvedValueOnce(pausedOffer);

    await expect(
      controller.updateStatus(usuario, offerId, statusDto),
    ).resolves.toEqual(pausedOffer);

    expect(updateStatusOffer).toHaveBeenCalledWith(
      'user-1',
      offerId,
      'PAUSADO',
    );
  });
  it('obtiene el resumen para el comerciante autenticado', async () => {
  const summary = {
    total: 6,
    activas: 3,
    pausadas: 1,
    proximasAVencer: 2,
    vencidas: 1,
    sinStock: 5,
    unidadesReservadas: 12,
  };
  getDashboardSummary.mockResolvedValueOnce(summary);

  await expect(controller.getDashboardSummary(usuario)).resolves.toEqual(
    summary,
  );

  expect(getDashboardSummary).toHaveBeenCalledWith('user-1');
  });
});