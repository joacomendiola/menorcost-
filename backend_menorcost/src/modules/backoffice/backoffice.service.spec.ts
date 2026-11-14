import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BackofficeService } from './backoffice.service.js';

const EMISOR = {
  id: 'emisor-1',
  nombre: 'Ana',
  apellido: 'Pérez',
  email: 'ana@example.com',
  rol: 'CLIENTE',
  estado: 'HABILITADO',
};

const DENUNCIADO = {
  id: 'denunciado-1',
  nombre: 'Luis',
  apellido: 'Gómez',
  email: 'luis@example.com',
  rol: 'CLIENTE',
  estado: 'BAJO_INVESTIGACION',
};

const prismaMock = {
  reporte: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  usuario: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  comercio: { findUnique: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
};

const mailerMock = { enviar: vi.fn() };

const service = new BackofficeService(
  prismaMock as never,
  mailerMock as never,
);

function reporteBase(overrides: Record<string, unknown> = {}) {
  return {
    id_reporte: 7,
    id_denunciado: DENUNCIADO.id,
    id_emisor: EMISOR.id,
    estado_reporte: 'PENDIENTE_REVISION',
    emisor: EMISOR,
    denunciado: DENUNCIADO,
    ...overrides,
  };
}

function comercioBase(overrides: Record<string, unknown> = {}) {
  return {
    idComercio: 'comercio-1',
    userId: DENUNCIADO.id,
    estado: 'PENDIENTE_VERIFICACION',
    usuario: { ...DENUNCIADO, deletedAt: null },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

  prismaMock.$transaction.mockImplementation(async (arg: any) => {
    if (typeof arg === 'function') return arg(prismaMock);
    return Promise.all(arg);
  });

  prismaMock.reporte.findUnique.mockResolvedValue(reporteBase());
  prismaMock.reporte.findUniqueOrThrow.mockResolvedValue(
    reporteBase({ estado_reporte: 'RESUELTO' }),
  );
  prismaMock.reporte.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.reporte.count.mockResolvedValue(0);
  prismaMock.usuario.findUnique.mockResolvedValue({
    estado: 'BAJO_INVESTIGACION',
  });
  prismaMock.usuario.findUniqueOrThrow.mockResolvedValue(DENUNCIADO);
  prismaMock.usuario.update.mockResolvedValue(DENUNCIADO);
  prismaMock.usuario.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.comercio.findUnique.mockResolvedValue(null);
  prismaMock.comercio.updateMany.mockResolvedValue({ count: 1 });
  mailerMock.enviar.mockResolvedValue(undefined);
});

describe('BackofficeService.aprobarAlta', () => {
  it('habilita usuario y comercio y envía el correo de bienvenida', async () => {
    prismaMock.comercio.findUnique.mockResolvedValue(comercioBase());
    prismaMock.usuario.findUniqueOrThrow.mockResolvedValue({
      ...DENUNCIADO,
      estado: 'HABILITADO',
    });

    const resultado = await service.aprobarAlta('comercio-1');

    expect(prismaMock.usuario.updateMany).toHaveBeenCalledWith({
      where: {
        id: DENUNCIADO.id,
        estado: 'PENDIENTE_VERIFICACION',
        deletedAt: null,
      },
      data: { estado: 'HABILITADO' },
    });
    expect(prismaMock.comercio.updateMany).toHaveBeenCalledWith({
      where: {
        idComercio: 'comercio-1',
        estado: 'PENDIENTE_VERIFICACION',
      },
      data: { estado: 'HABILITADO' },
    });
    expect(mailerMock.enviar).toHaveBeenCalledWith(
      expect.objectContaining({
        to: DENUNCIADO.email,
        subject: expect.stringContaining('Bienvenido'),
      }),
    );
    expect(resultado.notificacion).toEqual({ enviada: true });
  });

  it('revierte la aprobación si otro administrador ya procesó la solicitud', async () => {
    prismaMock.comercio.findUnique.mockResolvedValue(comercioBase());
    prismaMock.usuario.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.aprobarAlta('comercio-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(mailerMock.enviar).not.toHaveBeenCalled();
  });

  it('rechaza comercios eliminados', async () => {
    prismaMock.comercio.findUnique.mockResolvedValue(
      comercioBase({ usuario: { ...DENUNCIADO, deletedAt: new Date() } }),
    );

    await expect(
      service.aprobarAlta('comercio-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('BackofficeService.rechazarAlta', () => {
  it('marca usuario y comercio como documentación rechazada y envía el motivo', async () => {
    prismaMock.comercio.findUnique.mockResolvedValue(comercioBase());
    prismaMock.usuario.findUniqueOrThrow.mockResolvedValue({
      ...DENUNCIADO,
      estado: 'DOCUMENTACION_RECHAZADA',
    });

    const resultado = await service.rechazarAlta(
      'comercio-1',
      'CUIT inexistente',
    );

    expect(prismaMock.usuario.updateMany).toHaveBeenCalledWith({
      where: {
        id: DENUNCIADO.id,
        estado: 'PENDIENTE_VERIFICACION',
        deletedAt: null,
      },
      data: { estado: 'DOCUMENTACION_RECHAZADA' },
    });
    expect(prismaMock.comercio.updateMany).toHaveBeenCalledWith({
      where: {
        idComercio: 'comercio-1',
        estado: 'PENDIENTE_VERIFICACION',
      },
      data: { estado: 'DOCUMENTACION_RECHAZADA' },
    });
    expect(mailerMock.enviar).toHaveBeenCalledWith(
      expect.objectContaining({
        to: DENUNCIADO.email,
        html: expect.stringContaining('CUIT inexistente'),
      }),
    );
    expect(resultado.notificacion).toEqual({ enviada: true });
  });

  it('revierte el rechazo si otro administrador ya procesó la solicitud', async () => {
    prismaMock.comercio.findUnique.mockResolvedValue(comercioBase());
    prismaMock.usuario.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.rechazarAlta('comercio-1', 'Motivo'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(mailerMock.enviar).not.toHaveBeenCalled();
  });
});

describe('BackofficeService.cerrarReporte', () => {
  it.each([
    ['desestimar', 'DESESTIMADO', 'desestimado'],
    ['resolver', 'RESUELTO', 'resuelto'],
  ] as const)(
    '%s cierra el reporte, restaura la cuenta y notifica a ambas partes',
    async (metodo, estadoFinal, palabra) => {
      const resultado = await service[metodo](7, 'admin-1');

      expect(prismaMock.reporte.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id_reporte: 7 }),
          data: expect.objectContaining({ estado_reporte: estadoFinal }),
        }),
      );
      expect(prismaMock.usuario.updateMany).toHaveBeenCalledWith({
        where: { id: DENUNCIADO.id, estado: 'BAJO_INVESTIGACION' },
        data: { estado: 'HABILITADO' },
      });
      expect(mailerMock.enviar).toHaveBeenCalledTimes(2);
      expect(mailerMock.enviar).toHaveBeenCalledWith(
        expect.objectContaining({ to: EMISOR.email }),
      );
      expect(mailerMock.enviar).toHaveBeenCalledWith(
        expect.objectContaining({ to: DENUNCIADO.email }),
      );
      expect(resultado).toEqual({
        success: true,
        notificaciones: {
          emisor: { enviada: true },
          denunciado: { enviada: true },
        },
      });
      expect(mailerMock.enviar).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining(palabra),
        }),
      );
    },
  );

  it('no restaura la cuenta si el denunciado tiene otros reportes abiertos', async () => {
    prismaMock.reporte.count.mockResolvedValue(1);

    await service.desestimar(7, 'admin-1');

    expect(prismaMock.usuario.updateMany).not.toHaveBeenCalled();
  });

  it('devuelve advertencia si falla el correo de una de las partes', async () => {
    mailerMock.enviar.mockRejectedValueOnce(new Error('SMTP caído'));

    const resultado = await service.desestimar(7, 'admin-1');

    expect(resultado.notificaciones.emisor).toMatchObject({
      enviada: false,
      aviso: expect.stringContaining('no se pudo enviar'),
    });
    expect(resultado.notificaciones.denunciado).toEqual({ enviada: true });
  });

  it('rechaza reportes ya cerrados', async () => {
    prismaMock.reporte.findUnique.mockResolvedValue(
      reporteBase({ estado_reporte: 'DESESTIMADO' }),
    );

    await expect(service.desestimar(7, 'admin-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('BackofficeService.alternarInvestigacion', () => {
  it('no habilita la cuenta mientras queden reportes abiertos pendientes', async () => {
    prismaMock.reporte.findUnique.mockResolvedValue(
      reporteBase({ estado_reporte: 'BAJO_INVESTIGACION' }),
    );
    prismaMock.reporte.count.mockResolvedValue(1);

    await service.alternarInvestigacion(7);

    expect(prismaMock.reporte.count).toHaveBeenCalledWith({
      where: {
        id_denunciado: DENUNCIADO.id,
        estado_reporte: {
          in: ['PENDIENTE_REVISION', 'BAJO_INVESTIGACION'],
        },
        id_reporte: { not: 7 },
      },
    });
    expect(prismaMock.usuario.updateMany).not.toHaveBeenCalled();
  });

  it('habilita la cuenta si ya no quedan reportes abiertos', async () => {
    prismaMock.reporte.findUnique.mockResolvedValue(
      reporteBase({ estado_reporte: 'BAJO_INVESTIGACION' }),
    );
    prismaMock.reporte.count.mockResolvedValue(0);

    await service.alternarInvestigacion(7);

    expect(prismaMock.usuario.updateMany).toHaveBeenCalledWith({
      where: { id: DENUNCIADO.id, estado: 'BAJO_INVESTIGACION' },
      data: { estado: 'HABILITADO' },
    });
  });
});

describe('BackofficeService.sancionar', () => {
  it('suspende la cuenta, cierra denuncias y notifica a ambas partes', async () => {
    prismaMock.reporte.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 2 });

    const resultado = await service.sancionar(7, 'admin-1');

    expect(prismaMock.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DENUNCIADO.id },
        data: {
          estado: 'SUSPENDIDO',
          tokenVersion: { increment: 1 },
        },
      }),
    );
    expect(prismaMock.comercio.updateMany).not.toHaveBeenCalled();
    expect(mailerMock.enviar).toHaveBeenCalledTimes(2);
    expect(mailerMock.enviar).toHaveBeenCalledWith(
      expect.objectContaining({ to: EMISOR.email }),
    );
    expect(mailerMock.enviar).toHaveBeenCalledWith(
      expect.objectContaining({ to: DENUNCIADO.email }),
    );
    expect(resultado).toMatchObject({
      denunciasCerradas: 2,
      notificacion: { enviada: true },
      notificacionEmisor: { enviada: true },
    });
  });

  it('suspende también el comercio cuando el denunciado es comerciante', async () => {
    prismaMock.usuario.update.mockResolvedValue({
      ...DENUNCIADO,
      rol: 'COMERCIANTE',
    });

    const resultado = await service.sancionar(7, 'admin-1');

    expect(prismaMock.comercio.updateMany).toHaveBeenCalledWith({
      where: { userId: DENUNCIADO.id, estado: { not: 'SUSPENDIDO' } },
      data: { estado: 'SUSPENDIDO' },
    });
    expect(resultado.comercioSuspendido).toBe(true);
  });

  it('devuelve advertencia si falla el correo del emisor', async () => {
    mailerMock.enviar
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('SMTP caído'));

    const resultado = await service.sancionar(7, 'admin-1');

    expect(resultado.notificacion).toEqual({ enviada: true });
    expect(resultado.notificacionEmisor).toMatchObject({
      enviada: false,
      aviso: expect.stringContaining('no se pudo enviar'),
    });
  });

  it('rechaza reportes ya cerrados', async () => {
    prismaMock.reporte.findUnique.mockResolvedValue(
      reporteBase({ estado_reporte: 'RESUELTO' }),
    );

    await expect(service.sancionar(7, 'admin-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe('BackofficeService.rehabilitarUsuario', () => {
  it('rechaza usuarios inexistentes', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);

    await expect(service.rehabilitarUsuario('nadie')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rechaza usuarios que no están suspendidos ni investigados', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      ...DENUNCIADO,
      estado: 'HABILITADO',
    });

    await expect(
      service.rehabilitarUsuario(DENUNCIADO.id),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reactiva el comercio asociado al rehabilitar un comerciante', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      ...DENUNCIADO,
      rol: 'COMERCIANTE',
      estado: 'SUSPENDIDO',
    });
    prismaMock.usuario.update.mockResolvedValue({
      ...DENUNCIADO,
      estado: 'HABILITADO',
    });

    await service.rehabilitarUsuario(DENUNCIADO.id);

    expect(prismaMock.comercio.updateMany).toHaveBeenCalledWith({
      where: { userId: DENUNCIADO.id, estado: 'SUSPENDIDO' },
      data: { estado: 'HABILITADO' },
    });
  });
});
