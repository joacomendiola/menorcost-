import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BajaService } from './baja.service.js';

const prismaMock = {
  usuario: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  solicitudBaja: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  comercio: { updateMany: vi.fn() },
  $transaction: vi.fn(),
};
const bloqueosMock = {
  obtenerBloqueos: vi.fn(),
  obtenerResumenesCuentas: vi.fn(),
  pausarOfertas: vi.fn(),
  reactivarOfertas: vi.fn(),
};

const service = new BajaService(prismaMock as never, bloqueosMock as never);

async function usuarioBase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: 'x@y.com',
    rol: 'CLIENTE',
    estado: 'HABILITADO',
    passwordHash: await hash('Password123', 10),
    deletedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (arg: any) => {
    if (typeof arg === 'function') return arg(prismaMock);
    return Promise.all(arg);
  });
  prismaMock.solicitudBaja.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.comercio.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.usuario.findUnique.mockResolvedValue({
    rol: 'CLIENTE',
    comercio: null,
  });
  bloqueosMock.obtenerBloqueos.mockResolvedValue([]);
  bloqueosMock.obtenerResumenesCuentas.mockResolvedValue(new Map());
  bloqueosMock.pausarOfertas.mockResolvedValue(undefined);
  bloqueosMock.reactivarOfertas.mockResolvedValue(undefined);
});

describe('BajaService.solicitar', () => {
  it('rechaza contraseña incorrecta', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue(await usuarioBase());

    await expect(
      service.solicitar('u1', { motivo: 'x', password: 'Incorrecta1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza si ya hay una solicitud pendiente', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue(
      await usuarioBase({ estado: 'SOLICITUD_BAJA_PENDIENTE' }),
    );

    await expect(
      service.solicitar('u1', { motivo: 'x', password: 'Password123' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechaza si existen bloqueos', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue(await usuarioBase());
    bloqueosMock.obtenerBloqueos.mockResolvedValue([
      { tipo: 'PEDIDOS', message: 'Tenés pedidos pendientes' },
    ]);

    await expect(
      service.solicitar('u1', { motivo: 'x', password: 'Password123' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        bloqueos: [expect.objectContaining({ tipo: 'PEDIDOS' })],
      }),
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('registra la baja y pausa ofertas si es comerciante', async () => {
    prismaMock.usuario.findFirst.mockResolvedValue(
      await usuarioBase({ rol: 'COMERCIANTE' }),
    );
    prismaMock.solicitudBaja.create.mockReturnValue('crear-solicitud');
    prismaMock.usuario.update.mockReturnValue('actualizar-usuario');

    const resultado = await service.solicitar('u1', {
      motivo: 'Ya no la uso',
      password: 'Password123',
    });

    expect(prismaMock.solicitudBaja.create).toHaveBeenCalledWith({
      data: {
        usuarioId: 'u1',
        motivo: 'Ya no la uso',
        estadoPrevioUsuario: 'HABILITADO',
      },
    });
    expect(prismaMock.$transaction).toHaveBeenCalledWith([
      'crear-solicitud',
      'actualizar-usuario',
    ]);
    expect(bloqueosMock.pausarOfertas).toHaveBeenCalledWith('u1');
    expect(resultado.message).toMatch(/Solicitud de baja registrada/);
  });
});

describe('BajaService.listarSolicitudes', () => {
  it('agrega pedidos completados y saldo de tarifas', async () => {
    prismaMock.solicitudBaja.findMany.mockResolvedValue([
      { id: 's1', usuarioId: 'u1' },
      { id: 's2', usuarioId: 'u2' },
    ]);
    bloqueosMock.obtenerResumenesCuentas.mockResolvedValue(
      new Map([['u1', { pedidosCompletados: 4, saldoTarifas: 0 }]]),
    );

    const resultado = await service.listarSolicitudes();

    expect(bloqueosMock.obtenerResumenesCuentas).toHaveBeenCalledWith([
      'u1',
      'u2',
    ]);
    expect(resultado[0]).toMatchObject({
      pedidosCompletados: 4,
      saldoTarifas: 0,
    });
    expect(resultado[1]).toMatchObject({
      pedidosCompletados: 0,
      saldoTarifas: 0,
    });
  });
});

describe('BajaService.aprobar', () => {
  it('rechaza solicitudes inexistentes o ya resueltas', async () => {
    prismaMock.solicitudBaja.findUnique.mockResolvedValue(null);

    await expect(service.aprobar('admin', 's1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rechequea bloqueos antes de aprobar', async () => {
    prismaMock.solicitudBaja.findUnique.mockResolvedValue({
      id: 's1',
      usuarioId: 'u1',
      estado: 'PENDIENTE',
    });
    bloqueosMock.obtenerBloqueos.mockResolvedValue([
      { tipo: 'REPORTES', message: 'Denuncias abiertas' },
    ]);

    await expect(service.aprobar('admin', 's1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('inactiva la cuenta y cierra sesiones al aprobar', async () => {
    prismaMock.solicitudBaja.findUnique.mockResolvedValue({
      id: 's1',
      usuarioId: 'u1',
      estado: 'PENDIENTE',
    });

    const resultado = await service.aprobar('admin-1', 's1');

    expect(prismaMock.usuario.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { deletedAt: expect.any(Date), tokenVersion: { increment: 1 } },
    });
    expect(prismaMock.solicitudBaja.updateMany).toHaveBeenCalledWith({
      where: { id: 's1', estado: 'PENDIENTE' },
      data: {
        estado: 'APROBADA',
        resueltoPorId: 'admin-1',
        resueltoEn: expect.any(Date),
      },
    });
    expect(prismaMock.comercio.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', estado: { not: 'ELIMINADO' } },
      data: { estado: 'ELIMINADO' },
    });
    expect(resultado.message).toMatch(/Baja aprobada/);
  });

  it('no toca la cuenta si otro administrador ya resolvió la solicitud', async () => {
    prismaMock.solicitudBaja.findUnique.mockResolvedValue({
      id: 's1',
      usuarioId: 'u1',
      estado: 'PENDIENTE',
    });
    prismaMock.solicitudBaja.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.aprobar('admin-1', 's1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prismaMock.usuario.update).not.toHaveBeenCalled();
    expect(prismaMock.comercio.updateMany).not.toHaveBeenCalled();
  });
});

describe('BajaService.rechazar', () => {
  it('restaura la cuenta y reactiva ofertas', async () => {
    prismaMock.solicitudBaja.findUnique.mockResolvedValue({
      id: 's1',
      usuarioId: 'u1',
      estado: 'PENDIENTE',
    });

    await service.rechazar('admin-1', 's1', { observaciones: 'Motivo' });

    expect(prismaMock.solicitudBaja.updateMany).toHaveBeenCalledWith({
      where: { id: 's1', estado: 'PENDIENTE' },
      data: {
        estado: 'RECHAZADA',
        observaciones: 'Motivo',
        resueltoPorId: 'admin-1',
        resueltoEn: expect.any(Date),
      },
    });
    expect(prismaMock.usuario.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { estado: 'HABILITADO' },
    });
    expect(bloqueosMock.reactivarOfertas).toHaveBeenCalledWith('u1');
  });

  it('restaura el estado previo guardado en la solicitud', async () => {
    prismaMock.solicitudBaja.findUnique.mockResolvedValue({
      id: 's1',
      usuarioId: 'u1',
      estado: 'PENDIENTE',
      estadoPrevioUsuario: 'SUSPENDIDO',
    });

    await service.rechazar('admin-1', 's1', { observaciones: 'Motivo' });

    expect(prismaMock.usuario.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { estado: 'SUSPENDIDO' },
    });
  });

  it('no restaura la cuenta si otro administrador ya resolvió la solicitud', async () => {
    prismaMock.solicitudBaja.findUnique.mockResolvedValue({
      id: 's1',
      usuarioId: 'u1',
      estado: 'PENDIENTE',
    });
    prismaMock.solicitudBaja.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.rechazar('admin-1', 's1', { observaciones: 'Motivo' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prismaMock.usuario.update).not.toHaveBeenCalled();
    expect(bloqueosMock.reactivarOfertas).not.toHaveBeenCalled();
  });
});
