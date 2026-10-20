import {
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, RequestHandler } from 'express';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { OffersController } from './offers.controller.js';
import { OffersService } from './offers.service.js';

interface TestRequest extends Request {
  user?: { id: string };
}

const TEST_AUTHORIZATION = 'Bearer e2e-test-token';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
);

describe('POST /offers', () => {
  let app: INestApplication;

  const createOffer = vi.fn().mockResolvedValue({
    id: 'offer-1',
    imagen: '/uploads/test.png',
    estado: 'ACTIVO',
  });

  const testSessionMiddleware: RequestHandler = (req, _res, next) => {
    if (req.headers.authorization === TEST_AUTHORIZATION) {
      (req as TestRequest).user = { id: 'user-test' };
    }

    next();
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OffersController],
      providers: [
        {
          provide: OffersService,
          useValue: { create: createOffer },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();

    app.use(testSessionMiddleware);
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
  });

  beforeEach(() => {
    createOffer.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rechaza la solicitud si no hay sesión de prueba', async () => {
    await request(app.getHttpServer())
      .post('/offers')
      .field('tipo', 'INDIVIDUAL')
      .field('comercioId', '11111111-1111-4111-8111-111111111111')
      .field('categoriaId', '22222222-2222-4222-8222-222222222222')
      .field('titulo', 'Yogur')
      .field('descripcion', 'Pack de yogures')
      .field('fechaVencimiento', '2099-12-31')
      .field('stock', '5')
      .field('precioLista', '100.00')
      .field('precioMenorcost', '75.00')
      .attach('imagen', png, {
        filename: 'producto.png',
        contentType: 'image/png',
      })
      .expect(401);

    expect(createOffer).not.toHaveBeenCalled();
  });

  it('recibe los campos y la imagen y delega la creación', async () => {
    await request(app.getHttpServer())
      .post('/offers')
      .set('Authorization', TEST_AUTHORIZATION)
      .field('tipo', 'INDIVIDUAL')
      .field('comercioId', '11111111-1111-4111-8111-111111111111')
      .field('categoriaId', '22222222-2222-4222-8222-222222222222')
      .field('titulo', 'Yogur')
      .field('descripcion', 'Pack de yogures')
      .field('fechaVencimiento', '2099-12-31')
      .field('stock', '5')
      .field('precioLista', '100.00')
      .field('precioMenorcost', '75.00')
      .attach('imagen', png, {
        filename: 'producto.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(createOffer).toHaveBeenCalledWith(
      'user-test',
      expect.objectContaining({
        tipo: 'INDIVIDUAL',
        stock: 5,
        titulo: 'Yogur',
      }),
      expect.objectContaining({
        mimetype: 'image/png',
        buffer: expect.any(Buffer),
      }),
    );
  });

  it('rechaza la solicitud si no adjunta imagen', async () => {
    await request(app.getHttpServer())
      .post('/offers')
      .set('Authorization', TEST_AUTHORIZATION)
      .field('tipo', 'INDIVIDUAL')
      .field('comercioId', '11111111-1111-4111-8111-111111111111')
      .field('categoriaId', '22222222-2222-4222-8222-222222222222')
      .field('titulo', 'Yogur')
      .field('descripcion', 'Pack de yogures')
      .field('fechaVencimiento', '2099-12-31')
      .field('stock', '5')
      .field('precioLista', '100.00')
      .field('precioMenorcost', '75.00')
      .expect(400);

    expect(createOffer).not.toHaveBeenCalled();
  });

  it('rechaza un archivo que no es una imagen permitida', async () => {
    await request(app.getHttpServer())
      .post('/offers')
      .set('Authorization', TEST_AUTHORIZATION)
      .field('tipo', 'INDIVIDUAL')
      .field('comercioId', '11111111-1111-4111-8111-111111111111')
      .field('categoriaId', '22222222-2222-4222-8222-222222222222')
      .field('titulo', 'Yogur')
      .field('descripcion', 'Pack de yogures')
      .field('fechaVencimiento', '2099-12-31')
      .field('stock', '5')
      .field('precioLista', '100.00')
      .field('precioMenorcost', '75.00')
      .attach('imagen', Buffer.from('esto no es una imagen'), {
        filename: 'nota.txt',
        contentType: 'text/plain',
      })
      .expect(400);

    expect(createOffer).not.toHaveBeenCalled();
  });

  it('rechaza un archivo que declara ser PNG pero no tiene contenido PNG', async () => {
    await request(app.getHttpServer())
      .post('/offers')
      .set('Authorization', TEST_AUTHORIZATION)
      .field('tipo', 'INDIVIDUAL')
      .field('comercioId', '11111111-1111-4111-8111-111111111111')
      .field('categoriaId', '22222222-2222-4222-8222-222222222222')
      .field('titulo', 'Yogur')
      .field('descripcion', 'Pack de yogures')
      .field('fechaVencimiento', '2099-12-31')
      .field('stock', '5')
      .field('precioLista', '100.00')
      .field('precioMenorcost', '75.00')
      .attach('imagen', Buffer.from('esto no es una imagen real'), {
        filename: 'falso.png',
        contentType: 'image/png',
      })
      .expect(400);

    expect(createOffer).not.toHaveBeenCalled();
  });

  it('rechaza campos inválidos antes de llamar al servicio', async () => {
    await request(app.getHttpServer())
      .post('/offers')
      .set('Authorization', TEST_AUTHORIZATION)
      .field('tipo', 'INDIVIDUAL')
      .field('comercioId', '11111111-1111-4111-8111-111111111111')
      .field('categoriaId', '22222222-2222-4222-8222-222222222222')
      .field('titulo', 'Yogur')
      .field('descripcion', 'Pack de yogures')
      .field('fechaVencimiento', '2099-12-31')
      .field('stock', '0')
      .field('precioLista', '100.00')
      .field('precioMenorcost', '75.00')
      .attach('imagen', png, {
        filename: 'producto.png',
        contentType: 'image/png',
      })
      .expect(400);

    expect(createOffer).not.toHaveBeenCalled();
  });
});