import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateOfferDto } from './dto/create-offer.dto.js';
import type { OfferRecord } from './offer-creation.ports.js';
import { OffersController } from './offers.controller.js';
import { OffersService } from './offers.service.js';

describe('OffersController', () => {
  let controller: OffersController;
  let createOffer: ReturnType<typeof vi.fn>;

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

  const image = {
    buffer: Buffer.from('image'),
    mimetype: 'image/webp',
  } as Express.Multer.File;

  const offer: OfferRecord = {
    id: 'offer-1',
    imagen: '/uploads/test.webp',
    estado: 'ACTIVO',
  };

  beforeEach(async () => {
    createOffer = vi.fn().mockResolvedValue(offer);

    const moduleRef = await Test.createTestingModule({
      controllers: [OffersController],
      providers: [
        {
          provide: OffersService,
          useValue: { create: createOffer },
        },
      ],
    }).compile();

    controller = moduleRef.get(OffersController);
  });

  it('rechaza la solicitud si no hay usuario autenticado', () => {
    expect(() =>
      controller.create(
        {} as Parameters<OffersController['create']>[0],
        dto,
        image,
      ),
    ).toThrow(UnauthorizedException);

    expect(createOffer).not.toHaveBeenCalled();
  });

  it('envía los datos, el usuario y la imagen al servicio', async () => {
    const request = {
      user: { id: 'user-1' },
    } as Parameters<OffersController['create']>[0];

    await expect(controller.create(request, dto, image)).resolves.toEqual(offer);

    expect(createOffer).toHaveBeenCalledWith('user-1', dto, {
      buffer: image.buffer,
      mimetype: image.mimetype,
    });
  });
});