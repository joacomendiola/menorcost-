import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecuperacionService } from './recuperacion.service.js';

const prismaMock = {
  usuario: { findFirst: vi.fn(), update: vi.fn() },
  codigoSeguridad: { update: vi.fn() },
  $transaction: vi.fn(),
};
const configMock = { get: vi.fn() };
const codigosMock = {
  generarToken: vi.fn(),
  crear: vi.fn(),
  buscarPorToken: vi.fn(),
};
const mailerMock = { enviar: vi.fn() };

const service = new RecuperacionService(
  prismaMock as never,
  configMock as never,
  codigosMock as never,
  mailerMock as never,
);

beforeEach(() => {
  vi.clearAllMocks();
  configMock.get.mockReturnValue('http://localhost:5173');
  codigosMock.generarToken.mockReturnValue('token-de-prueba');
  codigosMock.crear.mockResolvedValue({});
  mailerMock.enviar.mockResolvedValue(undefined);
  prismaMock.usuario.update.mockResolvedValue({});
  prismaMock.codigoSeguridad.update.mockResolvedValue({});
  prismaMock.$transaction.mockResolvedValue([]);
});

describe('RecuperacionService.solicitar', () => {
  it('responde genérico y no envía correo si el email no existe', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue(null);

    const resultado = await service.solicitar({ email: 'nadie@x.com' });

    expect(resultado.message).toMatch(/Si el correo ingresado/);
    expect(mailerMock.enviar).not.toHaveBeenCalled();
  });

  it('no envía correo a cuentas suspendidas', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue({
      id: 'u1',
      estado: 'SUSPENDIDO',
      email: 'x@y.com',
    });

    await service.solicitar({ email: 'x@y.com' });

    expect(mailerMock.enviar).not.toHaveBeenCalled();
  });

  it('genera token y envía el enlace de restablecimiento', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue({
      id: 'u1',
      estado: 'HABILITADO',
      email: 'x@y.com',
    });

    await service.solicitar({ email: 'X@Y.com' });

    expect(codigosMock.crear).toHaveBeenCalledWith(
      'u1',
      'RECUPERACION_PASSWORD',
      'token-de-prueba',
      15,
    );
    expect(mailerMock.enviar).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining(
          'http://localhost:5173/restablecer-password?token=token-de-prueba',
        ),
      }),
    );
  });
});

describe('RecuperacionService.restablecer', () => {
  it('rechaza tokens inválidos o expirados', async () => {
    codigosMock.buscarPorToken.mockResolvedValue(null);

    await expect(
      service.restablecer({ token: 'invalido', password: 'Nueva12345' }),
    ).rejects.toThrow(BadRequestException);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('actualiza la contraseña e invalida sesiones previas', async () => {
    codigosMock.buscarPorToken.mockResolvedValue({
      id: 'c1',
      usuarioId: 'u1',
    });

    const resultado = await service.restablecer({
      token: 'valido',
      password: 'Nueva12345',
    });

    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(resultado.message).toMatch(/Contraseña actualizada/);
  });
});
