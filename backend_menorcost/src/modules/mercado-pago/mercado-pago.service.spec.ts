import { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import type { MercadoPagoClient } from './mercado-pago.client.js';
import type { MercadoPagoConfigService } from './mercado-pago.config.js';
import type { MercadoPagoCryptoService } from './mercado-pago-crypto.service.js';
import { MercadoPagoOauthError } from './mercado-pago.errors.js';
import { MercadoPagoService } from './mercado-pago.service.js';
import type { MercadoPagoStateService } from './mercado-pago-state.service.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const USUARIO_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const COMERCIO_ID = '11111111-1111-4111-8111-111111111111';

const usuario: AuthenticatedUser = {
  id: USUARIO_ID,
  email: 'comerciante@menorcost.local',
  rol: 'COMERCIANTE',
  estado: 'HABILITADO',
  comercioId: COMERCIO_ID,
};

function errorDuplicado(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: ['mp_user_id'] },
  });
}

describe('MercadoPagoService', () => {
  const prisma = {
    comercio: { findUnique: vi.fn() },
    credencialMp: { findUnique: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  };
  const tx = {
    credencialMp: { upsert: vi.fn(), deleteMany: vi.fn() },
    comercio: { update: vi.fn() },
  };
  const state = { crear: vi.fn(), consumir: vi.fn() };
  const client = { intercambiarCodigo: vi.fn() };
  const config = {
    pkceHabilitado: vi.fn(() => false),
    clientId: vi.fn(() => '123456'),
    redirectUri: vi.fn(() => 'http://localhost:3000/mercadopago/oauth/callback'),
  };
  const crypto = {
    cifrar: vi.fn((texto: string) => `cifrado:${texto}`),
  };

  const servicio = new MercadoPagoService(
    prisma as unknown as PrismaService,
    config as unknown as MercadoPagoConfigService,
    state as unknown as MercadoPagoStateService,
    client as unknown as MercadoPagoClient,
    crypto as unknown as MercadoPagoCryptoService,
  );

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (operacion: (cliente: typeof tx) => Promise<unknown>) => operacion(tx),
    );
    config.pkceHabilitado.mockReturnValue(false);
    config.clientId.mockReturnValue('123456');
    config.redirectUri.mockReturnValue(
      'http://localhost:3000/mercadopago/oauth/callback',
    );
    crypto.cifrar.mockImplementation((texto: string) => `cifrado:${texto}`);
    state.crear.mockResolvedValue('state-firmado');
    prisma.comercio.findUnique.mockResolvedValue({
      idComercio: COMERCIO_ID,
      userId: USUARIO_ID,
      estado: 'HABILITADO',
    });
    prisma.credencialMp.findUnique.mockResolvedValue(null);
  });

  describe('crearUrlAutorizacion', () => {
    it('arma la URL de autorización con state y redirect_uri estático', async () => {
      const { url } = await servicio.crearUrlAutorizacion(usuario);

      const parametros = new URL(url).searchParams;
      expect(url.startsWith('https://auth.mercadopago.com/authorization')).toBe(
        true,
      );
      expect(parametros.get('client_id')).toBe('123456');
      expect(parametros.get('response_type')).toBe('code');
      expect(parametros.get('platform_id')).toBe('mp');
      expect(parametros.get('state')).toBe('state-firmado');
      expect(parametros.get('redirect_uri')).toBe(
        'http://localhost:3000/mercadopago/oauth/callback',
      );
      expect(parametros.get('code_challenge')).toBeNull();
      expect(state.crear).toHaveBeenCalledWith(
        USUARIO_ID,
        COMERCIO_ID,
        undefined,
      );
    });

    it('agrega PKCE cuando está habilitado', async () => {
      config.pkceHabilitado.mockReturnValue(true);

      const { url } = await servicio.crearUrlAutorizacion(usuario);

      const parametros = new URL(url).searchParams;
      expect(parametros.get('code_challenge_method')).toBe('S256');
      expect(parametros.get('code_challenge')).toHaveLength(43);
      expect(state.crear).toHaveBeenCalledWith(
        USUARIO_ID,
        COMERCIO_ID,
        expect.any(String),
      );
    });

    it('rechaza si el comercio no está habilitado', async () => {
      prisma.comercio.findUnique.mockResolvedValue({
        idComercio: COMERCIO_ID,
        estado: 'PENDIENTE_VERIFICACION',
      });

      await expect(servicio.crearUrlAutorizacion(usuario)).rejects.toMatchObject(
        { motivo: 'comercio_no_habilitado' },
      );
    });

    it('rechaza si ya hay una credencial activa', async () => {
      prisma.credencialMp.findUnique.mockResolvedValue({ estado: 'ACTIVA' });

      await expect(servicio.crearUrlAutorizacion(usuario)).rejects.toMatchObject(
        { motivo: 'ya_vinculado' },
      );
    });

    it('rechaza si el usuario no está habilitado', async () => {
      const suspendido = { ...usuario, estado: 'SUSPENDIDO' as const };

      await expect(
        servicio.crearUrlAutorizacion(suspendido),
      ).rejects.toBeInstanceOf(MercadoPagoOauthError);
    });
  });

  describe('vincularDesdeCallback', () => {
    beforeEach(() => {
      state.consumir.mockResolvedValue({
        usuarioId: USUARIO_ID,
        comercioId: COMERCIO_ID,
      });
      client.intercambiarCodigo.mockResolvedValue({
        accessToken: 'APP_USR-access',
        refreshToken: 'TG-refresh',
        expiresIn: 15552000,
        userId: '999',
        scope: 'read write offline_access',
        liveMode: true,
      });
    });

    it('guarda la credencial cifrada y marca el comercio en una transacción', async () => {
      await servicio.vincularDesdeCallback({
        code: 'TG-code',
        state: 'state-firmado',
      });

      expect(state.consumir).toHaveBeenCalledWith('state-firmado');
      expect(tx.credencialMp.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { comercioId: COMERCIO_ID },
          update: expect.objectContaining({
            mpUserId: '999',
            accessToken: 'cifrado:APP_USR-access',
            refreshToken: 'cifrado:TG-refresh',
            scope: 'read write offline_access',
            liveMode: true,
            estado: 'ACTIVA',
          }),
        }),
      );
      expect(tx.comercio.update).toHaveBeenCalledWith({
        where: { idComercio: COMERCIO_ID },
        data: { mercadoPagoVinculado: true },
      });
    });

    it('traduce la cancelación del usuario', async () => {
      await expect(
        servicio.vincularDesdeCallback({ error: 'access_denied' }),
      ).rejects.toMatchObject({ motivo: 'cancelado' });
      expect(client.intercambiarCodigo).not.toHaveBeenCalled();
    });

    it('rechaza si el comercio ya no pertenece al usuario', async () => {
      prisma.comercio.findUnique.mockResolvedValue({
        idComercio: COMERCIO_ID,
        userId: 'otro',
        estado: 'HABILITADO',
      });

      await expect(
        servicio.vincularDesdeCallback({ code: 'c', state: 's' }),
      ).rejects.toMatchObject({ motivo: 'state_invalido' });
      expect(client.intercambiarCodigo).not.toHaveBeenCalled();
    });

    it('rechaza si la cuenta de Mercado Pago ya está en uso', async () => {
      prisma.$transaction.mockRejectedValueOnce(errorDuplicado());

      await expect(
        servicio.vincularDesdeCallback({ code: 'c', state: 's' }),
      ).rejects.toMatchObject({ motivo: 'cuenta_mp_en_uso' });
    });

    it('no escribe nada si falla el intercambio de tokens', async () => {
      client.intercambiarCodigo.mockRejectedValueOnce(
        new MercadoPagoOauthError('codigo_invalido', 'Código vencido'),
      );

      await expect(
        servicio.vincularDesdeCallback({ code: 'c', state: 's' }),
      ).rejects.toMatchObject({ motivo: 'codigo_invalido' });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('desconectar', () => {
    it('borra la credencial y baja el flag en una transacción', async () => {
      await servicio.desconectar(usuario);

      expect(tx.credencialMp.deleteMany).toHaveBeenCalledWith({
        where: { comercioId: COMERCIO_ID },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.comercio.update).toHaveBeenCalledWith({
        where: { idComercio: COMERCIO_ID },
        data: { mercadoPagoVinculado: false },
      });
    });
  });

  describe('obtenerEstado', () => {
    it('informa vinculado cuando la credencial está activa', async () => {
      prisma.credencialMp.findUnique.mockResolvedValue({
        estado: 'ACTIVA',
        fechaVinculacion: new Date('2026-11-01T10:00:00.000Z'),
        scope: 'read write offline_access',
        liveMode: false,
      });

      const estado = await servicio.obtenerEstado(usuario);

      expect(estado).toMatchObject({
        vinculado: true,
        estadoCredencial: 'ACTIVA',
        liveMode: false,
      });
    });

    it('informa no vinculado si no hay credencial', async () => {
      const estado = await servicio.obtenerEstado(usuario);

      expect(estado.vinculado).toBe(false);
      expect(estado.estadoCredencial).toBeNull();
    });
  });
});
