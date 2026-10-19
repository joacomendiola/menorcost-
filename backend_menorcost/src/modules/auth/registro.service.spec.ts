import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegistroService } from './registro.service.js';

const prismaMock = {
  usuario: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};
const authServiceMock = { firmarToken: vi.fn() };
const codigosMock = {
  generarCodigoNumerico: vi.fn(),
  crear: vi.fn(),
  validarPorUsuario: vi.fn(),
  consumir: vi.fn(),
};
const mailerMock = { enviar: vi.fn() };

const service = new RegistroService(
  prismaMock as never,
  authServiceMock as never,
  codigosMock as never,
  mailerMock as never,
);

const dtoBase = {
  dni: '12345678',
  nombre: 'Test',
  apellido: 'User',
  fechaNacimiento: '1990-01-01',
  telefono: '2900111222',
  email: 'Nuevo@Menorcost.local',
  password: 'Password123',
};

beforeEach(() => {
  vi.clearAllMocks();
  codigosMock.generarCodigoNumerico.mockReturnValue('123456');
  codigosMock.crear.mockResolvedValue({});
  mailerMock.enviar.mockResolvedValue(undefined);
});

describe('RegistroService.registrar', () => {
  it('rechaza DNI duplicado con mensaje específico', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue({ dni: '12345678' });

    await expect(service.registrar(dtoBase)).rejects.toThrow(ConflictException);
    await expect(service.registrar(dtoBase)).rejects.toThrow(
      /DNI ingresado ya se encuentra vinculado/,
    );
  });

  it('rechaza email duplicado con mensaje específico', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue({ dni: '99999999' });

    await expect(service.registrar(dtoBase)).rejects.toThrow(
      /correo electrónico ya pertenece/,
    );
  });

  it('rechaza fechas de nacimiento futuras', async () => {
    const futura = new Date();
    futura.setFullYear(futura.getFullYear() + 1);

    await expect(
      service.registrar({
        ...dtoBase,
        fechaNacimiento: futura.toISOString(),
      }),
    ).rejects.toThrow('Debés ser mayor de 8 años para registrarte');
    expect(prismaMock.usuario.findFirst).not.toHaveBeenCalled();
  });

  it('rechaza menores de 8 años', async () => {
    const hoy = new Date();
    const menor = new Date(
      hoy.getFullYear() - 7,
      hoy.getMonth(),
      hoy.getDate(),
    );

    await expect(
      service.registrar({
        ...dtoBase,
        fechaNacimiento: menor.toISOString(),
      }),
    ).rejects.toThrow('Debés ser mayor de 8 años para registrarte');
    expect(prismaMock.usuario.findFirst).not.toHaveBeenCalled();
  });

  it('acepta exactamente 8 años cumplidos', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue(null);
    prismaMock.usuario.create.mockResolvedValue({
      id: 'u1',
      email: 'nuevo@menorcost.local',
    });
    const hoy = new Date();
    const cumpleOcho = new Date(
      hoy.getFullYear() - 8,
      hoy.getMonth(),
      hoy.getDate(),
    );

    await expect(
      service.registrar({
        ...dtoBase,
        fechaNacimiento: cumpleOcho.toISOString(),
      }),
    ).resolves.toBeDefined();
  });

  it('crea el usuario en PENDIENTE_VERIFICACION y envía el OTP', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue(null);
    prismaMock.usuario.create.mockResolvedValue({
      id: 'u1',
      email: 'nuevo@menorcost.local',
    });

    const resultado = await service.registrar(dtoBase);

    expect(prismaMock.usuario.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'nuevo@menorcost.local',
        rol: 'CLIENTE',
        estado: 'PENDIENTE_VERIFICACION',
      }),
    });
    expect(codigosMock.crear).toHaveBeenCalledWith(
      'u1',
      'VERIFICACION_EMAIL',
      '123456',
      10,
    );
    expect(mailerMock.enviar).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'nuevo@menorcost.local' }),
    );
    expect(resultado.message).toMatch(/Cuenta creada/);
  });
});

describe('RegistroService.reenviarCodigo', () => {
  it('no envía correo si el usuario no está pendiente', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue({
      id: 'u1',
      estado: 'HABILITADO',
    });

    await service.reenviarCodigo({ email: 'x@y.com' });

    expect(mailerMock.enviar).not.toHaveBeenCalled();
  });

  it('reenvía si la cuenta está pendiente', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue({
      id: 'u1',
      estado: 'PENDIENTE_VERIFICACION',
      email: 'x@y.com',
    });

    await service.reenviarCodigo({ email: 'x@y.com' });

    expect(mailerMock.enviar).toHaveBeenCalled();
  });
});

describe('RegistroService.verificarCuenta', () => {
  it('rechaza si el usuario no está pendiente', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue({
      id: 'u1',
      estado: 'HABILITADO',
    });

    await expect(
      service.verificarCuenta({ email: 'x@y.com', codigo: '123456' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza un código inválido', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue({
      id: 'u1',
      estado: 'PENDIENTE_VERIFICACION',
    });
    codigosMock.validarPorUsuario.mockResolvedValue(null);

    await expect(
      service.verificarCuenta({ email: 'x@y.com', codigo: '000000' }),
    ).rejects.toThrow(/Código inválido o expirado/);
  });

  it('habilita la cuenta y devuelve el token', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue({
      id: 'u1',
      estado: 'PENDIENTE_VERIFICACION',
    });
    codigosMock.validarPorUsuario.mockResolvedValue({ id: 'c1' });
    prismaMock.usuario.update.mockResolvedValue({
      id: 'u1',
      nombre: 'Test',
      apellido: 'User',
      email: 'x@y.com',
      rol: 'CLIENTE',
      estado: 'HABILITADO',
    });
    authServiceMock.firmarToken.mockResolvedValue('jwt-token');

    const resultado = await service.verificarCuenta({
      email: 'x@y.com',
      codigo: '123456',
    });

    expect(codigosMock.consumir).toHaveBeenCalledWith('c1');
    expect(prismaMock.usuario.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { estado: 'HABILITADO' },
    });
    expect(resultado.accessToken).toBe('jwt-token');
    expect(resultado.usuario.estado).toBe('HABILITADO');
  });
});
