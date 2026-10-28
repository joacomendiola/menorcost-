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

const TEST_AUTHORIZATION = 'test-token-for-status-e2e';
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
  estado: 'PAUSADO',
};

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

describe('Endpoint HTTP de estado de ofertas', () => {
  let app: INestApplication;
  const updateStatus = vi.fn().mockResolvedValue(offerDetails);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OffersController],
      providers: [
        RolesGuard,
        {
          provide: OffersService,
          useValue: {
            create: vi.fn(),
            listByOwner: vi.fn(),
            getByIdForOwner: vi.fn(),
            update: vi.fn(),
            updateStatus,
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
    updateStatus.mockClear();
    updateStatus.mockResolvedValue(offerDetails);
  });

  afterAll(async () => {
    await app.close();
  });

  it('requiere autenticación para cambiar el estado', async () => {
    await request(app.getHttpServer())
      .patch(`/offers/${offerId}/status`)
      .send({ estado: 'PAUSADO' })
      .expect(401);

    expect(updateStatus).not.toHaveBeenCalled();
  });

  it('acepta pausar una oferta y delega usuario, ID y estado', async () => {
    await request(app.getHttpServer())
      .patch(`/offers/${offerId}/status`)
      .set('Authorization', TEST_AUTHORIZATION)
      .send({ estado: 'PAUSADO' })
      .expect(200)
      .expect(offerDetails);

    expect(updateStatus).toHaveBeenCalledWith(
      'user-test',
      offerId,
      'PAUSADO',
    );
  });

  it('rechaza un estado no permitido sin llamar al servicio', async () => {
    await request(app.getHttpServer())
      .patch(`/offers/${offerId}/status`)
      .set('Authorization', TEST_AUTHORIZATION)
      .send({ estado: 'VENCIDO_ELIMINADO' })
      .expect(400);

    expect(updateStatus).not.toHaveBeenCalled();
  });

  it('rechaza campos extra en el body', async () => {
    await request(app.getHttpServer())
      .patch(`/offers/${offerId}/status`)
      .set('Authorization', TEST_AUTHORIZATION)
      .send({ estado: 'PAUSADO', usuarioId: 'otro-usuario' })
      .expect(400);

    expect(updateStatus).not.toHaveBeenCalled();
  });

  it('rechaza un identificador que no sea UUID', async () => {
    await request(app.getHttpServer())
      .patch('/offers/no-es-uuid/status')
      .set('Authorization', TEST_AUTHORIZATION)
      .send({ estado: 'PAUSADO' })
      .expect(400);

    expect(updateStatus).not.toHaveBeenCalled();
  });
});