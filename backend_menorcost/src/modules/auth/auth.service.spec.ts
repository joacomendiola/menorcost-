import {
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';

const prismaMock = {
  usuario: { findFirst: vi.fn() },
};
const jwtMock = { signAsync: vi.fn() };

const service = new AuthService(prismaMock as never, jwtMock as never);

function usuarioBase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    dni: '12345678',
    nombre: 'Test',
    apellido: 'User',
    email: 'test@menorcost.local',
    telefono: '2900111222',
    fechaNacimiento: new Date('1990-01-01'),
    passwordHash: '',
    rol: 'CLIENTE',
    estado: 'HABILITADO',
    tokenVersion: 3,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  jwtMock.signAsync.mockResolvedValue('jwt-token');
});

describe('AuthService.login', () => {
  it('rechaza si el usuario no existe', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue(null);

    await expect(
      service.login({ email: 'nadie@x.com', password: 'Password123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza si la contraseña es incorrecta', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue(
      usuarioBase({ passwordHash: await hash('Correcta123', 10) }),
    );

    await expect(
      service.login({ email: 'test@menorcost.local', password: 'Incorrecta1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('bloquea cuentas PENDIENTE_VERIFICACION', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue(
      usuarioBase({
        estado: 'PENDIENTE_VERIFICACION',
        passwordHash: await hash('Password123', 10),
      }),
    );

    await expect(
      service.login({ email: 'test@menorcost.local', password: 'Password123' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'CUENTA_PENDIENTE_VERIFICACION',
      }),
    });
  });

  it('bloquea cuentas SUSPENDIDO', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue(
      usuarioBase({
        estado: 'SUSPENDIDO',
        passwordHash: await hash('Password123', 10),
      }),
    );

    await expect(
      service.login({ email: 'test@menorcost.local', password: 'Password123' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CUENTA_SUSPENDIDA' }),
    });
  });

  it('devuelve token y usuario público en login exitoso', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue(
      usuarioBase({ passwordHash: await hash('Password123', 10) }),
    );

    const resultado = await service.login({
      email: 'TEST@Menorcost.local',
      password: 'Password123',
    });

    expect(resultado.accessToken).toBe('jwt-token');
    expect(resultado.usuario).toEqual({
      id: 'u1',
      nombre: 'Test',
      apellido: 'User',
      email: 'test@menorcost.local',
      rol: 'CLIENTE',
      estado: 'HABILITADO',
    });
    expect(prismaMock.usuario.findFirst).toHaveBeenCalledWith({
      where: { email: 'test@menorcost.local', deletedAt: null },
    });
    expect(jwtMock.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'u1', tokenVersion: 3 }),
    );
  });
});

describe('AuthService.validarSesion', () => {
  it('devuelve null si la tokenVersion no coincide', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue(
      usuarioBase({ tokenVersion: 5 }),
    );

    await expect(service.validarSesion('u1', 3)).resolves.toBeNull();
  });

  it('devuelve el usuario si la sesión es válida', async () => {
    const usuario = usuarioBase({ tokenVersion: 3 });
    prismaMock.usuario.findFirst.mockResolvedValue(usuario);

    await expect(service.validarSesion('u1', 3)).resolves.toBe(usuario);
  });
});

describe('AuthService.firmarToken', () => {
  it('firma el payload esperado', async () => {
    await service.firmarToken(usuarioBase() as never);

    expect(jwtMock.signAsync).toHaveBeenCalledWith({
      sub: 'u1',
      email: 'test@menorcost.local',
      rol: 'CLIENTE',
      tokenVersion: 3,
      comercioId: null,
    });
  });
});

describe('AuthService.asegurarCuentaOperativa', () => {
  it('permite HABILITADO', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue(
      usuarioBase({ passwordHash: await hash('Password123', 10) }),
    );

    await expect(
      service.login({ email: 'test@menorcost.local', password: 'Password123' }),
    ).resolves.toBeDefined();
  });

  it('bloquea BAJO_INVESTIGACION', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue(
      usuarioBase({
        estado: 'BAJO_INVESTIGACION',
        passwordHash: await hash('Password123', 10),
      }),
    );

    await expect(
      service.login({ email: 'test@menorcost.local', password: 'Password123' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
