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
  comercio: { findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  producto: { updateMany: vi.fn() },
  pedido: { findUnique: vi.fn(), updateMany: vi.fn() },
  notificacion: { create: vi.fn() },
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
    id_pedido: 'pedido-1',
    id_denunciado: DENUNCIADO.id,
    id_emisor: EMISOR.id,
    estado_reporte: 'PENDIENTE_REVISION',
    tipo_destino: 'CLIENTE',
    motivo: 'El cliente no se presentó a retirar el producto',
    motivoCodigo: 'CLIENTE_NO_RETIRO',
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

  prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (tx: typeof prismaMock) => unknown)(prismaMock);
    }
    return Promise.all(arg as Promise<unknown>[]);
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
  prismaMock.comercio.findMany.mockResolvedValue([]);
  prismaMock.comercio.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.producto.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.pedido.findUnique.mockResolvedValue(null);
  prismaMock.pedido.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.notificacion.create.mockResolvedValue({});
  mailerMock.enviar.mockResolvedValue(undefined);
});

describe('BackofficeService.listarAltas', () => {
  it('incluye la resolución administrativa en el listado', async () => {
    await service.listarAltas();

    expect(prismaMock.comercio.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          resueltoPor: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              email: true,
            },
          },
        }),
      }),
    );
  });
});

describe('BackofficeService.aprobarAlta', () => {
  it('habilita usuario y comercio y envía el correo de bienvenida', async () => {
    prismaMock.comercio.findUnique.mockResolvedValue(comercioBase());
    prismaMock.usuario.findUniqueOrThrow.mockResolvedValue({
      ...DENUNCIADO,
      estado: 'HABILITADO',
    });

    const resultado = await service.aprobarAlta('comercio-1', 'admin-1');

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
      data: {
        estado: 'HABILITADO',
        resueltoPorId: 'admin-1',
        resueltoEn: expect.any(Date),
        motivoRechazo: null,
      },
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
      service.aprobarAlta('comercio-1', 'admin-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(mailerMock.enviar).not.toHaveBeenCalled();
  });

  it('rechaza comercios eliminados', async () => {
    prismaMock.comercio.findUnique.mockResolvedValue(
      comercioBase({ usuario: { ...DENUNCIADO, deletedAt: new Date() } }),
    );

    await expect(
      service.aprobarAlta('comercio-1', 'admin-1'),
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
      'admin-1',
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
      data: {
        estado: 'DOCUMENTACION_RECHAZADA',
        resueltoPorId: 'admin-1',
        resueltoEn: expect.any(Date),
        motivoRechazo: 'CUIT inexistente',
      },
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
      service.rechazarAlta('comercio-1', 'Motivo', 'admin-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(mailerMock.enviar).not.toHaveBeenCalled();
  });
});

describe('BackofficeService.cerrarReporte', () => {
  it.each([
    ['desestimar', 'DESESTIMADO', 'desestimado'],
    ['resolver', 'RESUELTO', 'resuelto sin sanción'],
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
        pedidoCancelado: null,
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

  it('cancela el pedido por falta de retiro al resolver un reporte del comercio', async () => {
    prismaMock.reporte.findUnique.mockResolvedValue(
      reporteBase({ id_pedido: 'pedido-1', id_emisor: 'comercio-user-1' }),
    );
    prismaMock.pedido.findUnique.mockResolvedValue({
      id_pedido: 'pedido-1',
      usuarioId: 'cliente-1',
      estado: 'PENDIENTE_DE_RETIRO',
      codigoAlfanumerico: 'MC-1',
      comercio: { userId: 'comercio-user-1' },
    });
    prismaMock.pedido.updateMany.mockResolvedValue({ count: 1 });

    const resultado = await service.resolver(7, 'admin-1');

    expect(prismaMock.pedido.updateMany).toHaveBeenCalledWith({
      where: { id_pedido: 'pedido-1', estado: 'PENDIENTE_DE_RETIRO' },
      data: { estado: 'CANCELADO_POR_FALTA_RETIRO' },
    });
    expect(prismaMock.notificacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usuarioId: 'cliente-1',
        tipo: 'PEDIDO_CANCELADO_POR_FALTA_RETIRO',
      }),
    });
    expect(resultado.pedidoCancelado).toEqual({
      usuarioId: 'cliente-1',
      codigoAlfanumerico: 'MC-1',
    });
  });

  it('no cancela el pedido si el reporte no lo emitió el comercio dueño', async () => {
    prismaMock.reporte.findUnique.mockResolvedValue(
      reporteBase({ id_pedido: 'pedido-1', id_emisor: 'otro-usuario' }),
    );
    prismaMock.pedido.findUnique.mockResolvedValue({
      id_pedido: 'pedido-1',
      usuarioId: 'cliente-1',
      estado: 'PENDIENTE_DE_RETIRO',
      codigoAlfanumerico: 'MC-1',
      comercio: { userId: 'comercio-user-1' },
    });

    const resultado = await service.resolver(7, 'admin-1');

    expect(prismaMock.pedido.updateMany).not.toHaveBeenCalled();
    expect(resultado.pedidoCancelado).toBeNull();
  });

  it('no cancela el pedido si el motivo no es falta de retiro', async () => {
    prismaMock.reporte.findUnique.mockResolvedValue(
      reporteBase({
        id_pedido: 'pedido-1',
        id_emisor: 'comercio-user-1',
        motivoCodigo: 'CANCELACION_INDEBIDA',
        motivo: 'Cancelación indebida en mostrador',
      }),
    );

    const resultado = await service.resolver(7, 'admin-1');

    expect(prismaMock.pedido.updateMany).not.toHaveBeenCalled();
    expect(resultado.pedidoCancelado).toBeNull();
  });

  it('no cancela el pedido si el reporte apunta al comercio', async () => {
    prismaMock.reporte.findUnique.mockResolvedValue(
      reporteBase({
        id_pedido: 'pedido-1',
        id_emisor: 'comercio-user-1',
        tipo_destino: 'COMERCIO',
      }),
    );

    const resultado = await service.resolver(7, 'admin-1');

    expect(prismaMock.pedido.updateMany).not.toHaveBeenCalled();
    expect(resultado.pedidoCancelado).toBeNull();
  });

  it('cancela reportes legacy de no-show sin motivoCodigo', async () => {
    prismaMock.reporte.findUnique.mockResolvedValue(
      reporteBase({
        id_pedido: 'pedido-1',
        id_emisor: 'comercio-user-1',
        motivoCodigo: null,
        motivo: 'El cliente no se presentó a retirar el producto',
      }),
    );
    prismaMock.pedido.findUnique.mockResolvedValue({
      id_pedido: 'pedido-1',
      usuarioId: 'cliente-1',
      estado: 'PENDIENTE_DE_RETIRO',
      codigoAlfanumerico: 'MC-1',
      comercio: { userId: 'comercio-user-1' },
    });
    prismaMock.pedido.updateMany.mockResolvedValue({ count: 1 });

    const resultado = await service.resolver(7, 'admin-1');

    expect(prismaMock.pedido.updateMany).toHaveBeenCalledWith({
      where: { id_pedido: 'pedido-1', estado: 'PENDIENTE_DE_RETIRO' },
      data: { estado: 'CANCELADO_POR_FALTA_RETIRO' },
    });
    expect(resultado.pedidoCancelado).toEqual({
      usuarioId: 'cliente-1',
      codigoAlfanumerico: 'MC-1',
    });
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
    expect(resultado).toMatchObject({ comercioSuspendido: true });
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

  it('da de baja las publicaciones reportadas sin suspender la cuenta', async () => {
    prismaMock.reporte.findUnique.mockResolvedValue(
      reporteBase({
        tipo_destino: 'COMERCIO',
        pedido: {
          comercioId: 'comercio-1',
          items: [
            { productoId: 'producto-1' },
            { productoId: 'producto-1' },
            { productoId: 'producto-2' },
          ],
        },
      }),
    );
    prismaMock.producto.updateMany.mockResolvedValue({ count: 2 });

    const resultado = await service.sancionar(7, 'admin-1', 'PUBLICACION');

    expect(prismaMock.reporte.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id_reporte: 7 }),
        data: expect.objectContaining({
          estado_reporte: 'RESUELTO',
          id_admin: 'admin-1',
        }),
      }),
    );
    expect(prismaMock.producto.updateMany).toHaveBeenCalledWith({
      where: {
        idProducto: { in: ['producto-1', 'producto-2'] },
        comercioId: 'comercio-1',
        estado: { not: 'ELIMINADO' },
      },
      data: { estado: 'ELIMINADO' },
    });
    expect(prismaMock.usuario.update).not.toHaveBeenCalled();
    expect(prismaMock.comercio.updateMany).not.toHaveBeenCalled();
    expect(resultado).toMatchObject({
      productosEliminados: 2,
      notificacion: { enviada: true },
      notificacionEmisor: { enviada: true },
    });
    expect(mailerMock.enviar).toHaveBeenCalledTimes(2);
  });

  it('rechaza dar de baja la publicación de un reporte dirigido a un cliente', async () => {
    prismaMock.reporte.findUnique.mockResolvedValue(
      reporteBase({
        tipo_destino: 'CLIENTE',
        pedido: {
          comercioId: 'comercio-1',
          items: [{ productoId: 'producto-1' }],
        },
      }),
    );

    await expect(
      service.sancionar(7, 'admin-1', 'PUBLICACION'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rechaza dar de baja una publicación sin artículos', async () => {
    prismaMock.reporte.findUnique.mockResolvedValue(
      reporteBase({
        tipo_destino: 'COMERCIO',
        pedido: { comercioId: 'comercio-1', items: [] },
      }),
    );

    await expect(
      service.sancionar(7, 'admin-1', 'PUBLICACION'),
    ).rejects.toBeInstanceOf(BadRequestException);
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

  it('rechaza rehabilitar una cuenta bajo investigación con reportes abiertos', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      ...DENUNCIADO,
      estado: 'BAJO_INVESTIGACION',
    });
    prismaMock.reporte.count.mockResolvedValue(1);

    await expect(
      service.rehabilitarUsuario(DENUNCIADO.id),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rehabilita una cuenta bajo investigación cuando ya no tiene reportes abiertos', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      ...DENUNCIADO,
      estado: 'BAJO_INVESTIGACION',
    });
    prismaMock.reporte.count.mockResolvedValue(0);
    prismaMock.usuario.update.mockResolvedValue({
      ...DENUNCIADO,
      estado: 'HABILITADO',
    });

    await service.rehabilitarUsuario(DENUNCIADO.id);

    expect(prismaMock.reporte.count).toHaveBeenCalledWith({
      where: {
        id_denunciado: DENUNCIADO.id,
        estado_reporte: {
          in: ['PENDIENTE_REVISION', 'BAJO_INVESTIGACION'],
        },
      },
    });
    expect(prismaMock.usuario.update).toHaveBeenCalledWith({
      where: { id: DENUNCIADO.id },
      data: { estado: 'HABILITADO' },
      select: expect.anything(),
    });
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
