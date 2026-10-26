import {
  UnauthorizedException,
  ValidationPipe,
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { OffersController } from './ofertas.controller.js';
import { OffersService } from './ofertas.service.js';

const TEST_AUTHORIZATION = 'test-token-for-e2e';

const testJwtGuard: CanActivate = {
  canActivate(context: ExecutionContext): boolean {
    const httpRequest = context
      .switchToHttp()
      .getRequest<{
        headers: { authorization?: string };
        user?: AuthenticatedUser;
      }>();

    if (httpRequest.headers.authorization !== TEST_AUTHORIZATION) {
      throw new UnauthorizedException('Token de prueba no válido');
    }

    httpRequest.user = {
      id: 'user-test',
      email: 'comerciante@example.com',
      rol: 'COMERCIANTE',
      estado: 'HABILITADO',
    };

    return true;
  },
};

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
);

describe('Endpoints HTTP de ofertas', () => {
  let app: INestApplication;

  const offerId = '33333333-3333-4333-8333-333333333333';

  const offerDetails = {
    id: offerId,
    comercioId: '11111111-1111-4111-8111-111111111111',
    categoriaId: '22222222-2222-4222-8222-222222222222',
    tipo: 'INDIVIDUAL',
    titulo: 'Yogur',
    descripcion: 'Pack de yogures',
    fechaVencimiento: '2099-12-31',
    stock: 5,
    precioLista: '100.00',
    precioMenorcost: '75.00',
    imagen: '/uploads/test.png',
    estado: 'ACTIVO',
  };

  const createOffer = vi.fn().mockResolvedValue({
    id: 'offer-1',
    imagen: '/uploads/test.png',
    estado: 'ACTIVO',
  });
  const listOffers = vi.fn().mockResolvedValue([offerDetails]);
  const getOffer = vi.fn().mockResolvedValue(offerDetails);
  const updateOffer = vi.fn().mockResolvedValue(offerDetails);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OffersController],
      providers: [
        RolesGuard,
        {
          provide: OffersService,
          useValue: {
            create: createOffer,
            listByOwner: listOffers,
            getByIdForOwner: getOffer,
            update: updateOffer,
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(testJwtGuard)
      .compile();

    app = moduleRef.createNestApplication();

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
    listOffers.mockClear();
    getOffer.mockClear();
    updateOffer.mockClear();
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

  it('rechaza la solicitud si no adjunta imagen al crear', async () => {
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

  it('lista las ofertas del comerciante autenticado', async () => {
    await request(app.getHttpServer())
      .get('/offers')
      .set('Authorization', TEST_AUTHORIZATION)
      .expect(200)
      .expect([offerDetails]);

    expect(listOffers).toHaveBeenCalledWith('user-test');
  });

  it('consulta una oferta por UUID para el comerciante autenticado', async () => {
    await request(app.getHttpServer())
      .get(`/offers/${offerId}`)
      .set('Authorization', TEST_AUTHORIZATION)
      .expect(200)
      .expect(offerDetails);

    expect(getOffer).toHaveBeenCalledWith('user-test', offerId);
  });

    it('rechaza un identificador inválido al actualizar', async () => {
    await request(app.getHttpServer())
      .patch('/offers/no-es-un-uuid')
      .set('Authorization', TEST_AUTHORIZATION)
      .field('precioMenorcost', '70.00')
      .expect(400);

    expect(updateOffer).not.toHaveBeenCalled();
  });

  it('rechaza un precio con formato inválido antes de llamar al servicio', async () => {
    await request(app.getHttpServer())
      .patch(`/offers/${offerId}`)
      .set('Authorization', TEST_AUTHORIZATION)
      .field('precioMenorcost', '70.999')
      .expect(400);

    expect(updateOffer).not.toHaveBeenCalled();
  });

  it('rechaza campos que no forman parte de la actualización', async () => {
    await request(app.getHttpServer())
      .patch(`/offers/${offerId}`)
      .set('Authorization', TEST_AUTHORIZATION)
      .field('titulo', 'Otro título')
      .expect(400);

    expect(updateOffer).not.toHaveBeenCalled();
  });

  it('rechaza una imagen de tipo no permitido al actualizar', async () => {
    await request(app.getHttpServer())
      .patch(`/offers/${offerId}`)
      .set('Authorization', TEST_AUTHORIZATION)
      .field('precioMenorcost', '70.00')
      .attach('imagen', Buffer.from('no es una imagen'), {
        filename: 'nota.txt',
        contentType: 'text/plain',
      })
      .expect(400);

    expect(updateOffer).not.toHaveBeenCalled();
  });

  it('rechaza un identificador de oferta que no sea UUID', async () => {
    await request(app.getHttpServer())
      .get('/offers/no-es-un-uuid')
      .set('Authorization', TEST_AUTHORIZATION)
      .expect(400);

    expect(getOffer).not.toHaveBeenCalled();
  });

  it('actualiza la oferta sin requerir una imagen nueva', async () => {
    await request(app.getHttpServer())
      .patch(`/offers/${offerId}`)
      .set('Authorization', TEST_AUTHORIZATION)
      .field('precioMenorcost', '70.00')
      .expect(200)
      .expect(offerDetails);

    expect(updateOffer).toHaveBeenCalledWith(
      'user-test',
      offerId,
      expect.objectContaining({ precioMenorcost: '70.00' }),
      undefined,
    );
  });

  it('actualiza la oferta y acepta una nueva imagen', async () => {
    await request(app.getHttpServer())
      .patch(`/offers/${offerId}`)
      .set('Authorization', TEST_AUTHORIZATION)
      .field('precioMenorcost', '70.00')
      .attach('imagen', png, {
        filename: 'producto.png',
        contentType: 'image/png',
      })
      .expect(200);

    expect(updateOffer).toHaveBeenCalledWith(
      'user-test',
      offerId,
      expect.objectContaining({ precioMenorcost: '70.00' }),
      expect.objectContaining({
        mimetype: 'image/png',
        buffer: expect.any(Buffer),
      }),
    );
  });
});