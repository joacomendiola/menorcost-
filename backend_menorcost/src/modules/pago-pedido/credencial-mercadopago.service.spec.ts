import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { MercadoPagoCryptoService } from '../mercado-pago/mercado-pago-crypto.service.js';
import type { ClienteMercadoPago } from './cliente-mercadopago.js';
import { CredencialMercadoPagoService } from './credencial-mercadopago.service.js';
import { ErrorPagoMercadoPago } from './error-pago-mercadopago.js';

const COMERCIO_ID = '11111111-1111-4111-8111-111111111111';
const CREDENCIAL_ID = '22222222-2222-4222-8222-222222222222';

function credencial(sobrescribir: Record<string, unknown> = {}) {
  return {
    idCredencial: CREDENCIAL_ID,
    accessToken: 'cifrado:access-viejo',
    refreshToken: 'cifrado:refresh-viejo',
    // Por defecto vence en una hora: no hace falta renovar.
    fechaTokenExpiration: new Date(Date.now() + 60 * 60 * 1000),
    estado: 'ACTIVA' as const,
    ...sobrescribir,
  };
}

describe('CredencialMercadoPagoService', () => {
  const prisma = {
    credencialMp: { findUnique: vi.fn(), update: vi.fn() },
  };
  const crypto = {
    cifrar: vi.fn((texto: string) => `cifrado:${texto}`),
    descifrar: vi.fn((texto: string) => texto.replace('cifrado:', '')),
  };
  const cliente = { refrescarToken: vi.fn() };

  const servicio = new CredencialMercadoPagoService(
    prisma as unknown as PrismaService,
    crypto as unknown as MercadoPagoCryptoService,
    cliente as unknown as ClienteMercadoPago,
  );

  beforeEach(() => {
    vi.resetAllMocks();
    crypto.cifrar.mockImplementation((texto: string) => `cifrado:${texto}`);
    crypto.descifrar.mockImplementation((texto: string) =>
      texto.replace('cifrado:', ''),
    );
    prisma.credencialMp.update.mockResolvedValue({});
  });

  it('descifra el access token cuando todavía no está por vencer', async () => {
    prisma.credencialMp.findUnique.mockResolvedValue(credencial());

    await expect(
      servicio.obtenerCredencialActiva(COMERCIO_ID),
    ).resolves.toEqual({
      idCredencial: CREDENCIAL_ID,
      accessToken: 'access-viejo',
    });
    expect(cliente.refrescarToken).not.toHaveBeenCalled();
    expect(prisma.credencialMp.update).not.toHaveBeenCalled();
  });

  it('renueva cuando vence en menos de cinco minutos y persiste los tokens cifrados', async () => {
    prisma.credencialMp.findUnique.mockResolvedValue(
      credencial({ fechaTokenExpiration: new Date(Date.now() + 60 * 1000) }),
    );
    cliente.refrescarToken.mockResolvedValue({
      access_token: 'access-nuevo',
      refresh_token: 'refresh-nuevo',
      expires_in: 15_552_000,
    });

    const antes = Date.now();
    const resultado = await servicio.obtenerCredencialActiva(COMERCIO_ID);

    expect(cliente.refrescarToken).toHaveBeenCalledWith('refresh-viejo');
    expect(resultado).toEqual({
      idCredencial: CREDENCIAL_ID,
      accessToken: 'access-nuevo',
    });

    const datos = prisma.credencialMp.update.mock.calls[0][0].data;
    expect(datos.accessToken).toBe('cifrado:access-nuevo');
    expect(datos.refreshToken).toBe('cifrado:refresh-nuevo');
    expect(datos.fechaTokenExpiration.getTime()).toBeGreaterThanOrEqual(
      antes + 15_552_000 * 1000,
    );
  });

  it('marca la credencial como EXPIRADA si Mercado Pago rechaza la renovación', async () => {
    prisma.credencialMp.findUnique.mockResolvedValue(
      credencial({ fechaTokenExpiration: new Date(Date.now() - 1000) }),
    );
    cliente.refrescarToken.mockRejectedValue(
      new ErrorPagoMercadoPago(
        'credencial_invalida',
        'La vinculación con Mercado Pago venció.',
      ),
    );

    await expect(
      servicio.obtenerCredencialActiva(COMERCIO_ID),
    ).rejects.toMatchObject({ codigo: 'credencial_invalida' });

    expect(prisma.credencialMp.update).toHaveBeenCalledWith({
      where: { idCredencial: CREDENCIAL_ID },
      data: { estado: 'EXPIRADA' },
    });
  });

  it('no marca EXPIRADA si Mercado Pago está caído: la credencial se puede reintentar', async () => {
    prisma.credencialMp.findUnique.mockResolvedValue(
      credencial({ fechaTokenExpiration: new Date(Date.now() - 1000) }),
    );
    cliente.refrescarToken.mockRejectedValue(
      new ErrorPagoMercadoPago(
        'mp_no_disponible',
        'Mercado Pago está con problemas momentáneos.',
      ),
    );

    await expect(
      servicio.obtenerCredencialActiva(COMERCIO_ID),
    ).rejects.toMatchObject({ codigo: 'mp_no_disponible' });

    expect(prisma.credencialMp.update).not.toHaveBeenCalled();
  });

  it('rechaza si el comercio no tiene credencial', async () => {
    prisma.credencialMp.findUnique.mockResolvedValue(null);

    await expect(
      servicio.obtenerCredencialActiva(COMERCIO_ID),
    ).rejects.toMatchObject({ codigo: 'credencial_invalida' });
    expect(cliente.refrescarToken).not.toHaveBeenCalled();
  });

  it('rechaza si la credencial no está ACTIVA', async () => {
    prisma.credencialMp.findUnique.mockResolvedValue(
      credencial({ estado: 'REVOCADA' }),
    );

    await expect(
      servicio.obtenerCredencialActiva(COMERCIO_ID),
    ).rejects.toMatchObject({ codigo: 'credencial_invalida' });
    expect(cliente.refrescarToken).not.toHaveBeenCalled();
  });
});
