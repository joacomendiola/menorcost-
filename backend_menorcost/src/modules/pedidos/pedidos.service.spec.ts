import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { PedidosService } from './pedidos.service.js';

describe('PedidosService', () => {
  const usuarioId = '11111111-1111-4111-8111-111111111111';
  const comercioId = '22222222-2222-4222-8222-222222222222';
  const pedidoId = '33333333-3333-4333-8333-333333333333';

  const prisma = {
    pedido: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  };

  const service = new PedidosService(prisma as never);

  const pedidoBase = {
    id_pedido: pedidoId,
    codigoAlfanumerico: 'HRWWLBWY',
    codigoQR: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    estado: 'PENDIENTE_DE_RETIRO',
    fecha_pedido: new Date('2026-11-17T04:33:49.000Z'),
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
    reportes: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listar', () => {
    it('excluye los pagos rechazados y ordena por fecha descendente', async () => {
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
          where: {
            usuarioId,
            estado: { not: 'PENDIENTE_PAGO' },
          },
          orderBy: { fecha_pedido: 'desc' },
        }),
      );
      expect(resultado).toEqual([
        {
          idPedido: pedidoId,
          codigoAlfanumerico: 'HRWWLBWY',
          estado: 'PENDIENTE_DE_RETIRO',
          fechaPedido: '2026-11-17T04:33:49.000Z',
          total: 5600,
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
});
