import {
  UnauthorizedException,
  ValidationPipe,
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { OffersController } from './ofertas.controller.js';
import { OffersService } from './ofertas.service.js';


const TEST_AUTHORIZATION = 'Bearer test-token';

const testJwtGuard: CanActivate = {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{
        headers: { authorization?: string };
        user?: AuthenticatedUser;
      }>();

    if (request.headers.authorization !== TEST_AUTHORIZATION) {
      throw new UnauthorizedException('Token de prueba no válido');
    }

    request.user = {
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

describe('POST /offers', () => {
  let app: INestApplication;

  const createOffer = vi.fn().mockResolvedValue({
    id: 'offer-1',
    imagen: '/uploads/test.png',
    estado: 'ACTIVO',
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OffersController],
      providers: [
        RolesGuard,
        {
          provide: OffersService,
          useValue: { create: createOffer },
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