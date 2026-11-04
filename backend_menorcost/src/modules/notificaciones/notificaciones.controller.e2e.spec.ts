import {
  UnauthorizedException,
  ValidationPipe,
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { NotificacionesController } from './notificaciones.controller.js';
import { NotificacionesService } from './notificaciones.service.js';

const TEST_AUTHORIZATION = 'test-token-for-notifications-e2e';

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

describe('Endpoints HTTP de notificaciones', () => {
  let app: INestApplication;

  const notification = {
    id: '11111111-1111-4111-8111-111111111111',
    titulo: 'Oferta vencida',
    mensaje:
      'La oferta "Canasta de verduras" fue retirada automáticamente por alcanzar su fecha de vencimiento.',
    tipo: 'OFERTA_VENCIDA',
    leida: false,
    createdAt: '2026-11-03T03:00:00.000Z',
  };

  const listByUser = vi.fn();
  const markAsRead = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificacionesController],
      providers: [
        {
          provide: NotificacionesService,
          useValue: {
            listarPorUsuario: listByUser,
            marcarComoLeida: markAsRead,
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
    listByUser.mockReset();
    markAsRead.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rechaza listar notificaciones sin autenticación', async () => {
    await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', 'token-invalido')
      .expect(401);

    expect(listByUser).not.toHaveBeenCalled();
  });

  it('lista las notificaciones del usuario autenticado', async () => {
    listByUser.mockResolvedValue([notification]);

    await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', TEST_AUTHORIZATION)
      .expect(200)
      .expect([notification]);

    expect(listByUser).toHaveBeenCalledWith('user-test');
  });

  it('marca como leída una notificación válida', async () => {
    const updatedNotification = {
      ...notification,
      leida: true,
    };

    markAsRead.mockResolvedValue(updatedNotification);

    await request(app.getHttpServer())
      .patch(`/notifications/${notification.id}/read`)
      .set('Authorization', TEST_AUTHORIZATION)
      .expect(200)
      .expect(updatedNotification);

    expect(markAsRead).toHaveBeenCalledWith(
      'user-test',
      notification.id,
    );
  });

  it('rechaza un identificador de notificación inválido', async () => {
    await request(app.getHttpServer())
      .patch('/notifications/id-invalido/read')
      .set('Authorization', TEST_AUTHORIZATION)
      .expect(400);

    expect(markAsRead).not.toHaveBeenCalled();
  });
});