import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportesService } from './reportes.service.js';
import type { CrearReporteDto } from './dto/crear-reporte.dto.js';

const PEDIDO_ID = '11111111-1111-4111-8111-111111111111';
const CLIENTE_ID = 'cliente-1';
const COMERCIANTE_ID = 'comerciante-1';

const prismaMock = {
  pedido: { findUnique: vi.fn(), findMany: vi.fn() },
  comercio: { findUnique: vi.fn() },
  reporte: {
    findFirst: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
  },
  usuario: { findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
};

const mailerMock = { enviar: vi.fn() };
const service = new ReportesService(prismaMock as never, mailerMock as never);

function pedidoBase(overrides: Record<string, unknown> = {}) {
  return {
    id_pedido: PEDIDO_ID,
    usuarioId: CLIENTE_ID,
    estado: 'ENTREGADO',
    comercio: { usuario: { id: COMERCIANTE_ID } },
    ...overrides,
  };
}

function dtoBase(overrides: Partial<CrearReporteDto> = {}): CrearReporteDto {
  return {
    idPedido: PEDIDO_ID,
    motivo: 'El local estaba cerrado',
    tipo_destino: 'COMERCIO',
    ...overrides,
  };
}

function reporteCreado(overrides: Record<string, unknown> = {}) {
  return {
    id_reporte: 1,
    id_pedido: PEDIDO_ID,
    motivo: 'El local estaba cerrado',
    descripcion: null,
    estado_reporte: 'PENDIENTE_REVISION',
    tipo_destino: 'COMERCIO',
    id_emisor: CLIENTE_ID,
    id_denunciado: COMERCIANTE_ID,
    emisor: {
      id: CLIENTE_ID,
      nombre: 'Cliente',
      apellido: 'Prueba',
      email: 'cliente@example.com',
    },
    denunciado: {
      id: COMERCIANTE_ID,
      nombre: 'Comerciante',
      apellido: 'Prueba',
      email: 'comerciante@example.com',
    },
    fecha_reporte: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  prismaMock.$transaction.mockImplementation(async (arg: any) => {
    if (typeof arg === 'function') return arg(prismaMock);
    return Promise.all(arg);
  });

  prismaMock.pedido.findUnique.mockResolvedValue(pedidoBase());
  prismaMock.usuario.findUnique.mockResolvedValue({
    estado: 'HABILITADO',
    deletedAt: null,
  });
  prismaMock.comercio.findUnique.mockResolvedValue({ idComercio: 'comercio-1' });
  prismaMock.reporte.findFirst.mockResolvedValue(null);
  prismaMock.reporte.create.mockResolvedValue(reporteCreado());
  prismaMock.reporte.findMany.mockResolvedValue([]);
  prismaMock.reporte.count.mockResolvedValue(0);
  prismaMock.reporte.findUnique.mockResolvedValue(null);
  prismaMock.usuario.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.usuario.findMany.mockResolvedValue([{ email: 'admin@example.com' }]);
  mailerMock.enviar.mockResolvedValue(undefined);
});

describe('ReportesService.crearReporte', () => {
  it('rechaza pedidos inexistentes', async () => {
    prismaMock.pedido.findUnique.mockResolvedValue(null);

    await expect(
      service.crearReporte(CLIENTE_ID, 'CLIENTE', dtoBase()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza pedidos sin comercio asociado', async () => {
    prismaMock.pedido.findUnique.mockResolvedValue(
      pedidoBase({ comercio: null }),
    );

    await expect(
      service.crearReporte(CLIENTE_ID, 'CLIENTE', dtoBase()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza clientes que reportan pedidos ajenos', async () => {
    prismaMock.pedido.findUnique.mockResolvedValue(
      pedidoBase({ usuarioId: 'otro-cliente' }),
    );

    await expect(
      service.crearReporte(CLIENTE_ID, 'CLIENTE', dtoBase()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza comerciantes que reportan pedidos de otro comercio', async () => {
    prismaMock.pedido.findUnique.mockResolvedValue(
      pedidoBase({ comercio: { usuario: { id: 'otro-comercio' } } }),
    );

    await expect(
      service.crearReporte(COMERCIANTE_ID, 'COMERCIANTE', dtoBase({
        tipo_destino: 'CLIENTE',
      })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza administradores', async () => {
    await expect(
      service.crearReporte('admin-1', 'ADMINISTRADOR', dtoBase()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  const casosPermitidos = [
    ['CLIENTE', 'ENTREGADO', 'COMERCIO', CLIENTE_ID],
    ['CLIENTE', 'PENDIENTE_DE_RETIRO', 'COMERCIO', CLIENTE_ID],
    ['CLIENTE', 'CANCELADO', 'COMERCIO', CLIENTE_ID],
    ['COMERCIANTE', 'ENTREGADO', 'CLIENTE', COMERCIANTE_ID],
    ['COMERCIANTE', 'PENDIENTE_DE_RETIRO', 'CLIENTE', COMERCIANTE_ID],
    ['COMERCIANTE', 'CANCELADO', 'CLIENTE', COMERCIANTE_ID],
    [
      'COMERCIANTE',
      'CANCELADO_POR_FALTA_RETIRO',
      'CLIENTE',
      COMERCIANTE_ID,
    ],
  ] as const;

  it.each(casosPermitidos)(
    'permite a %s reportar un pedido en estado %s',
    async (rol, estado, tipoDestino, idUsuario) => {
      prismaMock.pedido.findUnique.mockResolvedValue(
        pedidoBase({ estado }),
      );
      prismaMock.reporte.create.mockResolvedValue(
        reporteCreado({
          tipo_destino: tipoDestino,
          id_emisor: idUsuario,
          id_denunciado:
            tipoDestino === 'COMERCIO' ? COMERCIANTE_ID : CLIENTE_ID,
        }),
      );

      const resultado = await service.crearReporte(
        idUsuario,
        rol,
        dtoBase({ tipo_destino: tipoDestino }),
      );

      expect(prismaMock.reporte.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id_pedido: PEDIDO_ID,
            estado_reporte: 'PENDIENTE_REVISION',
            tipo_destino: tipoDestino,
            id_emisor: idUsuario,
          }),
        }),
      );
      expect(resultado).toMatchObject({
        estado_reporte: 'PENDIENTE_REVISION',
        tipo_destino: tipoDestino,
      });
    },
  );

  const casosRechazados = [
    ['CLIENTE', 'CANCELADO_POR_FALTA_RETIRO', 'COMERCIO', CLIENTE_ID],
    ['CLIENTE', 'PENDIENTE_PAGO', 'COMERCIO', CLIENTE_ID],
    ['COMERCIANTE', 'PENDIENTE_PAGO', 'CLIENTE', COMERCIANTE_ID],
  ] as const;

  it.each(casosRechazados)(
    'rechaza a %s reportar un pedido en estado %s',
    async (rol, estado, tipoDestino, idUsuario) => {
      prismaMock.pedido.findUnique.mockResolvedValue(
        pedidoBase({ estado }),
      );

      await expect(
        service.crearReporte(
          idUsuario,
          rol,
          dtoBase({ tipo_destino: tipoDestino }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaMock.reporte.create).not.toHaveBeenCalled();
    },
  );

  it('rechaza un tipo_destino que no corresponde al rol', async () => {
    await expect(
      service.crearReporte(
        CLIENTE_ID,
        'CLIENTE',
        dtoBase({ tipo_destino: 'CLIENTE' }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza un reporte abierto previo del mismo emisor', async () => {
    prismaMock.reporte.findFirst.mockResolvedValue({ id_reporte: 99 });

    await expect(
      service.crearReporte(CLIENTE_ID, 'CLIENTE', dtoBase()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('exige descripción cuando el motivo es "Otro motivo"', async () => {
    await expect(
      service.crearReporte(
        CLIENTE_ID,
        'CLIENTE',
        dtoBase({ motivo: 'Otro motivo' }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('permite "Otro motivo" con descripción', async () => {
    await service.crearReporte(
      CLIENTE_ID,
      'CLIENTE',
      dtoBase({ motivo: 'Otro motivo', descripcion: 'Detalle del problema' }),
    );

    expect(prismaMock.reporte.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          motivo: 'Otro motivo',
          descripcion: 'Detalle del problema',
        }),
      }),
    );
  });

  it('notifica a los administradores activos al crear el reporte', async () => {
    prismaMock.reporte.create.mockResolvedValue(
      reporteCreado({ motivo: '<motivo>' }),
    );

    const resultado = await service.crearReporte(
      CLIENTE_ID,
      'CLIENTE',
      dtoBase({ motivo: '<motivo>' }),
    );

    expect(prismaMock.usuario.findMany).toHaveBeenCalledWith({
      where: {
        rol: 'ADMINISTRADOR',
        estado: 'HABILITADO',
        deletedAt: null,
      },
      select: { email: true },
    });
    expect(mailerMock.enviar).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@example.com',
        subject: 'Nuevo reporte #1',
        html: expect.stringContaining('&lt;motivo&gt;'),
      }),
    );
    expect(resultado.notificacionSoporte).toEqual({
      enviada: true,
      destinatarios: 1,
    });
  });

  it('expone el fallo de notificación sin perder el reporte creado', async () => {
    mailerMock.enviar.mockRejectedValueOnce(new Error('SMTP caído'));

    const resultado = await service.crearReporte(
      CLIENTE_ID,
      'CLIENTE',
      dtoBase(),
    );

    expect(prismaMock.reporte.create).toHaveBeenCalled();
    expect(resultado).toMatchObject({
      id_reporte: 1,
      notificacionSoporte: {
        enviada: false,
        destinatarios: 1,
        aviso: expect.stringContaining('no se pudo notificar'),
      },
    });
  });

  it('indica cuando no hay administradores activos para notificar', async () => {
    prismaMock.usuario.findMany.mockResolvedValue([]);

    const resultado = await service.crearReporte(
      CLIENTE_ID,
      'CLIENTE',
      dtoBase(),
    );

    expect(resultado.notificacionSoporte).toMatchObject({
      enviada: false,
      destinatarios: 0,
    });
    expect(mailerMock.enviar).not.toHaveBeenCalled();
  });

  it('crea el reporte y no investiga con hasta 3 reportes abiertos', async () => {
    prismaMock.reporte.count.mockResolvedValue(3);

    const resultado = await service.crearReporte(
      CLIENTE_ID,
      'CLIENTE',
      dtoBase(),
    );

    expect(prismaMock.reporte.count).toHaveBeenCalledWith({
      where: {
        id_denunciado: COMERCIANTE_ID,
        estado_reporte: { in: ['PENDIENTE_REVISION', 'BAJO_INVESTIGACION'] },
      },
    });
    expect(prismaMock.usuario.updateMany).not.toHaveBeenCalled();
    expect(resultado).toMatchObject({
      estado_reporte: 'PENDIENTE_REVISION',
      id_denunciado: COMERCIANTE_ID,
    });
  });

  it('activa BAJO_INVESTIGACION al superar 3 reportes abiertos', async () => {
    prismaMock.reporte.count.mockResolvedValue(4);

    await service.crearReporte(CLIENTE_ID, 'CLIENTE', dtoBase());

    expect(prismaMock.usuario.updateMany).toHaveBeenCalledWith({
      where: { id: COMERCIANTE_ID, estado: 'HABILITADO' },
      data: { estado: 'BAJO_INVESTIGACION' },
    });
  });

  it('rechaza reportes de cuentas que no están habilitadas', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue({
      estado: 'SOLICITUD_BAJA_PENDIENTE',
      deletedAt: null,
    });

    await expect(
      service.crearReporte(CLIENTE_ID, 'CLIENTE', dtoBase()),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.reporte.create).not.toHaveBeenCalled();
  });

  it('convierte conflictos de serialización en respuesta recuperable', async () => {
    prismaMock.$transaction.mockRejectedValueOnce({ code: 'P2034' });

    await expect(
      service.crearReporte(CLIENTE_ID, 'CLIENTE', dtoBase()),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('ReportesService.listarPedidosReportablesComerciante', () => {
  it('limita pedidos y reportes abiertos al comercio y emisor autenticados', async () => {
    prismaMock.pedido.findMany.mockResolvedValue([
      {
        id_pedido: PEDIDO_ID,
        codigoAlfanumerico: 'MC-123',
        estado: 'ENTREGADO',
        fecha_pedido: new Date('2026-01-01T00:00:00.000Z'),
        total: 250,
        items: [],
        reportes: [],
      },
    ]);

    const resultado =
      await service.listarPedidosReportablesComerciante(COMERCIANTE_ID);

    expect(prismaMock.pedido.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          comercioId: 'comercio-1',
          estado: {
            in: [
              'ENTREGADO',
              'PENDIENTE_DE_RETIRO',
              'CANCELADO',
              'CANCELADO_POR_FALTA_RETIRO',
            ],
          },
        },
        select: expect.objectContaining({
          reportes: expect.objectContaining({
            where: {
              id_emisor: COMERCIANTE_ID,
              estado_reporte: {
                in: ['PENDIENTE_REVISION', 'BAJO_INVESTIGACION'],
              },
            },
            take: 1,
          }),
        }),
      }),
    );
    expect(resultado[0]).toMatchObject({ reporteAbierto: null });
  });
});

describe('ReportesService.listarMisReportes', () => {
  it('aplica paginación por defecto', async () => {
    prismaMock.reporte.count.mockResolvedValue(12);

    const resultado = await service.listarMisReportes(CLIENTE_ID, {});

    expect(prismaMock.reporte.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_emisor: CLIENTE_ID },
        skip: 0,
        take: 10,
      }),
    );
    expect(resultado.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 12,
      totalPages: 2,
    });
  });

  it('filtra por estado', async () => {
    await service.listarMisReportes(CLIENTE_ID, {
      estado: 'PENDIENTE_REVISION',
    });

    expect(prismaMock.reporte.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id_emisor: CLIENTE_ID,
          estado_reporte: 'PENDIENTE_REVISION',
        },
      }),
    );
  });

  it('limita el tamaño de página y calcula el offset', async () => {
    await service.listarMisReportes(CLIENTE_ID, { page: 3, limit: 999 });

    expect(prismaMock.reporte.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 100, take: 50 }),
    );
  });

  it('devuelve los reportes y el total', async () => {
    const reportes = [reporteCreado()];
    prismaMock.reporte.findMany.mockResolvedValue(reportes);
    prismaMock.reporte.count.mockResolvedValue(1);

    const resultado = await service.listarMisReportes(CLIENTE_ID, {});

    expect(resultado.data).toEqual(reportes);
    expect(resultado.pagination.total).toBe(1);
  });
});

describe('ReportesService.obtenerDetalleReporte', () => {
  const reporteDetalle = {
    id_reporte: 1,
    id_emisor: CLIENTE_ID,
    id_denunciado: COMERCIANTE_ID,
    pedido: { id_pedido: PEDIDO_ID, estado: 'ENTREGADO' },
  };

  it('rechaza reportes inexistentes', async () => {
    await expect(
      service.obtenerDetalleReporte(CLIENTE_ID, 1, 'CLIENTE'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('permite al emisor ver el detalle', async () => {
    prismaMock.reporte.findUnique.mockResolvedValue(reporteDetalle);

    const resultado = await service.obtenerDetalleReporte(
      CLIENTE_ID,
      1,
      'CLIENTE',
    );

    expect(resultado).toEqual(reporteDetalle);
  });

  it('permite al denunciado ver el detalle', async () => {
    prismaMock.reporte.findUnique.mockResolvedValue(reporteDetalle);

    const resultado = await service.obtenerDetalleReporte(
      COMERCIANTE_ID,
      1,
      'COMERCIANTE',
    );

    expect(resultado).toEqual(reporteDetalle);
  });

  it('permite al administrador ver cualquier detalle', async () => {
    prismaMock.reporte.findUnique.mockResolvedValue(reporteDetalle);

    const resultado = await service.obtenerDetalleReporte(
      'admin-1',
      1,
      'ADMINISTRADOR',
    );

    expect(resultado).toEqual(reporteDetalle);
  });

  it('rechaza a terceros', async () => {
    prismaMock.reporte.findUnique.mockResolvedValue(reporteDetalle);

    await expect(
      service.obtenerDetalleReporte('tercero-1', 1, 'CLIENTE'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
