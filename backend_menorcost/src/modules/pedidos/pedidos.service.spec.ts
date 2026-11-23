import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { PedidosService } from './pedidos.service.js';

describe('PedidosService', () => {
  const usuarioId = '11111111-1111-4111-8111-111111111111';
  const clienteId = '99999999-9999-4999-8999-999999999999';
  const comercioId = '22222222-2222-4222-8222-222222222222';
  const pedidoId = '33333333-3333-4333-8333-333333333333';

  const prisma = {
    pedido: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    pedidoItem: {
      findMany: vi.fn(),
    },
    producto: {
      updateMany: vi.fn(),
    },
    notificacion: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  prisma.$transaction.mockImplementation(
    async (callback: (client: typeof prisma) => unknown) => callback(prisma),
  );

  const service = new PedidosService(prisma as never);

  const pedidoComercio = {
    id_pedido: pedidoId,
    codigoAlfanumerico: 'HRWWLBWY',
    estado: 'PENDIENTE_DE_RETIRO',
    fecha_pedido: new Date('2026-11-17T04:33:49.000Z'),
    fecha_entrega: null,
    total: new Prisma.Decimal('5600.00'),
    usuario: { nombre: 'Ana', apellido: 'Paz' },
    pagos: [{ estado: 'PAGADO' }],
    items: [{ cantidad: 2, nombreHistorico: 'Yogur entero' }],
  };

  const pedidoBase = {
    id_pedido: pedidoId,
    codigoAlfanumerico: 'HRWWLBWY',
    codigoQR: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    estado: 'PENDIENTE_DE_RETIRO',
    fecha_pedido: new Date('2026-11-17T04:33:49.000Z'),
    fecha_entrega: null,
    subtotal: new Prisma.Decimal('5600.00'),
    tarifa_servicio: new Prisma.Decimal('600.00'),
    total: new Prisma.Decimal('5600.00'),
    comercio: {
      idComercio: comercioId,
      nombreFantasia: 'Mercado del Barrio',
      abierto: true,
    },
    franjaHoraria: { horaInicio: '09:00', horaFin: '10:00' },
    items: [
      {
        id_pedido_item: '44444444-4444-4444-8444-444444444444',
        nombreHistorico: 'Yogur entero',
        cantidad: 2,
        precio_unitario: new Prisma.Decimal('2800.00'),
        subtotal: new Prisma.Decimal('5600.00'),
        producto: { imagen: '/uploads/yogur.jpg' },
      },
    ],
    calificacion: null,
    pagos: [{ estado: 'PAGADO' }],
    reportes: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.pedido.findUnique.mockResolvedValue(null);
    prisma.pedido.updateMany.mockResolvedValue({ count: 1 });
    prisma.pedidoItem.findMany.mockResolvedValue([]);
    prisma.producto.updateMany.mockResolvedValue({ count: 1 });
    prisma.notificacion.create.mockResolvedValue({ id: 1 });
  });

  describe('listar', () => {
    it('incluye los pendientes de pago (para reintentar) y ordena por fecha descendente', async () => {
      prisma.pedido.findMany.mockResolvedValue([
        {
          id_pedido: pedidoId,
          codigoAlfanumerico: 'HRWWLBWY',
          estado: 'PENDIENTE_DE_RETIRO',
          fecha_pedido: new Date('2026-11-17T04:33:49.000Z'),
          total: new Prisma.Decimal('5600.00'),
          comercio: {
            idComercio: comercioId,
            nombreFantasia: 'Mercado del Barrio',
          },
          franjaHoraria: { horaInicio: '09:00', horaFin: '10:00' },
          items: [{ cantidad: 2, nombreHistorico: 'Yogur entero' }],
        },
      ]);

      const resultado = await service.listar(usuarioId);

      expect(prisma.pedido.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { usuarioId },
          orderBy: { fecha_pedido: 'desc' },
        }),
      );
      expect(resultado).toEqual([
        {
          idPedido: pedidoId,
          codigoAlfanumerico: 'HRWWLBWY',
          estado: 'PENDIENTE_DE_RETIRO',
          fechaPedido: '2026-11-17T04:33:49.000Z',
          total: '5600.00',
          comercio: {
            idComercio: comercioId,
            nombre: 'Mercado del Barrio',
          },
          franjaHorario: { inicio: '09:00', fin: '10:00' },
          itemsCantidad: 2,
          items: [{ titulo: 'Yogur entero', cantidad: 2 }],
        },
      ]);
    });
  });

  describe('obtenerPorCodigo', () => {
    it('busca por código alfanumérico o QR del propio usuario', async () => {
      prisma.pedido.findFirst.mockResolvedValue(pedidoBase);

      const resultado = await service.obtenerPorCodigo(usuarioId, 'hrwwlbwy');

      expect(prisma.pedido.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            usuarioId,
            estado: { not: 'PENDIENTE_PAGO' },
            OR: [
              { codigoAlfanumerico: { in: ['hrwwlbwy', 'HRWWLBWY'] } },
              { codigoQR: { in: ['hrwwlbwy', 'HRWWLBWY'] } },
            ],
          },
        }),
      );
      expect(resultado).toMatchObject({
        idPedido: pedidoId,
        codigoAlfanumerico: 'HRWWLBWY',
        codigoQR: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        estado: 'PENDIENTE_DE_RETIRO',
        total: 5600,
        subtotal: 5600,
        tarifaServicio: 600,
        localAbierto: true,
        comercio: { idComercio: comercioId, nombre: 'Mercado del Barrio' },
        franjaHorario: { inicio: '09:00', fin: '10:00' },
        items: [
          {
            id: '44444444-4444-4444-8444-444444444444',
            titulo: 'Yogur entero',
            imagen: '/uploads/yogur.jpg',
            cantidad: 2,
            precioUnitario: 2800,
            subtotal: 5600,
          },
        ],
        calificacion: null,
        misReportes: [],
      });
    });

    it('devuelve la calificación y los reportes del emisor', async () => {
      prisma.pedido.findFirst.mockResolvedValue({
        ...pedidoBase,
        calificacion: {
          id_calificacion: 7,
          puntaje: 4,
          comentario: 'Muy bien',
          fecha_creacion: new Date('2026-11-18T10:00:00.000Z'),
        },
        reportes: [
          {
            id_reporte: 3,
            motivo: 'Otro',
            estado_reporte: 'PENDIENTE_REVISION',
            fecha_reporte: new Date('2026-11-19T11:00:00.000Z'),
          },
        ],
      });

      const resultado = await service.obtenerPorCodigo(usuarioId, 'HRWWLBWY');

      expect(resultado.calificacion).toEqual({
        id: 7,
        puntaje: 4,
        comentario: 'Muy bien',
        fecha: '2026-11-18T10:00:00.000Z',
      });
      expect(resultado.misReportes).toEqual([
        {
          id: 3,
          motivo: 'Otro',
          estado: 'PENDIENTE_REVISION',
          fecha: '2026-11-19T11:00:00.000Z',
        },
      ]);
    });

    it('lanza 404 si el pedido no existe o es de otro usuario', async () => {
      prisma.pedido.findFirst.mockResolvedValue(null);

      await expect(
        service.obtenerPorCodigo(usuarioId, 'NOEXISTE'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('validarEntrega', () => {
    it('habilita la entrega cuando el pedido está pendiente y el pago aprobado', async () => {
      prisma.pedido.findFirst.mockResolvedValue(pedidoComercio);

      const resultado = await service.validarEntrega(usuarioId, 'hrwwlbwy');

      expect(resultado.puedeEntregar).toBe(true);
      expect(resultado.motivo).toBeNull();
      expect(resultado.pedido).toMatchObject({
        idPedido: pedidoId,
        estado: 'PENDIENTE_DE_RETIRO',
        pagoEstado: 'PAGADO',
      });
    });

    it('bloquea la entrega si el pago no figura aprobado', async () => {
      prisma.pedido.findFirst.mockResolvedValue({
        ...pedidoComercio,
        pagos: [{ estado: 'PENDIENTE' }],
      });

      const resultado = await service.validarEntrega(usuarioId, 'HRWWLBWY');

      expect(resultado.puedeEntregar).toBe(false);
      expect(resultado.motivo).toBe(
        'El pago del pedido no figura como aprobado.',
      );
    });

    it('lanza 404 si el código no pertenece a su comercio', async () => {
      prisma.pedido.findFirst.mockResolvedValue(null);

      await expect(
        service.validarEntrega(usuarioId, 'NOEXISTE'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('confirmarEntrega', () => {
    const pedidoAEentregar = {
      id_pedido: pedidoId,
      usuarioId: clienteId,
      estado: 'PENDIENTE_DE_RETIRO',
      codigoAlfanumerico: 'HRWWLBWY',
      comercio: { userId: usuarioId },
      pagos: [{ estado: 'PAGADO' }],
    };

    it('pasa el pedido a ENTREGADO y guarda la fecha de entrega', async () => {
      prisma.pedido.findUnique.mockResolvedValue(pedidoAEentregar);

      const resultado = await service.confirmarEntrega(usuarioId, pedidoId);

      expect(resultado).toEqual({
        idPedido: pedidoId,
        estado: 'ENTREGADO',
        yaEntregado: false,
      });
      expect(prisma.pedido.updateMany).toHaveBeenCalledWith({
        where: { id_pedido: pedidoId, estado: 'PENDIENTE_DE_RETIRO' },
        data: { estado: 'ENTREGADO', fecha_entrega: expect.any(Date) },
      });
      expect(prisma.notificacion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tipo: 'PEDIDO_ENTREGADO' }) }),
      );
    });

    it('es idempotente si el pedido ya fue entregado', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        ...pedidoAEentregar,
        estado: 'ENTREGADO',
      });

      const resultado = await service.confirmarEntrega(usuarioId, pedidoId);

      expect(resultado).toEqual({
        idPedido: pedidoId,
        estado: 'ENTREGADO',
        yaEntregado: true,
      });
      expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
    });

    it('lanza 404 si el pedido es de otro comercio', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        ...pedidoAEentregar,
        comercio: { userId: clienteId },
      });

      await expect(
        service.confirmarEntrega(usuarioId, pedidoId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('no entrega un pedido sin pago aprobado', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        ...pedidoAEentregar,
        pagos: [{ estado: 'PENDIENTE' }],
      });

      await expect(
        service.confirmarEntrega(usuarioId, pedidoId),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
    });

    it('trata como idempotente una carrera perdida contra otra entrega', async () => {
      prisma.pedido.findUnique
        .mockResolvedValueOnce(pedidoAEentregar)
        .mockResolvedValueOnce({ estado: 'ENTREGADO' });
      prisma.pedido.updateMany.mockResolvedValue({ count: 0 });

      const resultado = await service.confirmarEntrega(usuarioId, pedidoId);

      expect(resultado.yaEntregado).toBe(true);
    });
  });

  describe('cancelarPendientePago', () => {
    const pedidoPendiente = {
      id_pedido: pedidoId,
      usuarioId: clienteId,
      estado: 'PENDIENTE_PAGO',
      codigoAlfanumerico: 'HRWWLBWY',
      comercio: { userId: usuarioId },
      items: [{ productoId: '55555555-5555-4555-8555-555555555555', cantidad: 2 }],
    };

    it('cancela el pedido y restaura el stock reservado', async () => {
      prisma.pedido.findUnique.mockResolvedValue(pedidoPendiente);
      prisma.pedidoItem.findMany.mockResolvedValue(pedidoPendiente.items);

      const resultado = await service.cancelarPendientePago(
        usuarioId,
        pedidoId,
      );

      expect(resultado).toEqual({
        idPedido: pedidoId,
        estado: 'CANCELADO',
        stockRestaurado: true,
      });
      expect(prisma.pedido.updateMany).toHaveBeenCalledWith({
        where: {
          id_pedido: pedidoId,
          estado: 'PENDIENTE_PAGO',
          stockLiberadoEn: null,
        },
        data: expect.objectContaining({
          estado: 'CANCELADO',
          motivoCancelacion: 'CANCELADO_POR_COMERCIO',
        }),
      });
      expect(prisma.producto.updateMany).toHaveBeenCalledWith({
        where: { idProducto: pedidoPendiente.items[0].productoId },
        data: { stock: { increment: 2 } },
      });
    });

    it('no cancela un pedido que ya no está pendiente de pago', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        ...pedidoPendiente,
        estado: 'PENDIENTE_DE_RETIRO',
      });

      await expect(
        service.cancelarPendientePago(usuarioId, pedidoId),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('lanza 404 si el pedido es de otro comercio', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        ...pedidoPendiente,
        comercio: { userId: clienteId },
      });

      await expect(
        service.cancelarPendientePago(usuarioId, pedidoId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
