import {
  ConflictException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { CheckoutService } from './checkout.service.js';

describe('CheckoutService', () => {
  const usuarioId = '11111111-1111-4111-8111-111111111111';
  const comercioId = '22222222-2222-4222-8222-222222222222';
  const canastaId = '33333333-3333-4333-8333-333333333333';
  const franjaId = '44444444-4444-4444-8444-444444444444';
  const productoId = '55555555-5555-4555-8555-555555555555';

  const tx = {
    canasta: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    producto: {
      updateMany: vi.fn(),
    },
    pedido: {
      create: vi.fn(),
    },
  };

  const prisma = {
    canasta: {
      findUnique: vi.fn(),
    },
    comercio: {
      findUnique: vi.fn(),
    },
    pedido: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };

  const detalle = {
    idCanasta: canastaId,
    comercioId,
    comercio: { nombreFantasia: 'Almacén del Centro' },
    subtotal: '9411.78',
    items: [
      {
        idCanastaItem: '66666666-6666-4666-8666-666666666666',
        productoId,
        cantidad: 2,
        precioUnitario: '4705.89',
        subtotal: '9411.78',
        producto: {
          idProducto: productoId,
          titulo: 'Yogur entero',
          imagen: '/uploads/yogur.jpg',
          stock: 10,
          precioPublico: '4705.89',
          precioBaseNeto: '1000.00',
          comisionMenorcostTasaAplicada: '0.1000',
          tasaMpEstimadaAplicada: '0.0650',
          estado: 'ACTIVO',
          fechaVencimiento: '2026-12-31',
        },
      },
    ],
  };

  const canastas = {
    obtenerCanastaParaCheckout: vi.fn(),
  };

  const franjas = {
    listarParaCheckout: vi.fn(),
    validarParaCheckout: vi.fn(),
  };

  const pasarela = {
    cobrar: vi.fn(),
  };

  let service: CheckoutService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CheckoutService(
      prisma as never,
      canastas as never,
      franjas as never,
      pasarela as never,
    );

    prisma.canasta.findUnique.mockResolvedValue({ idCanasta: canastaId });
    prisma.pedido.findUnique.mockResolvedValue(null);
    prisma.comercio.findUnique.mockResolvedValue({
      nombreFantasia: 'Almacén del Centro',
      calle: 'Av. San Martín',
      numero: '123',
      piso: null,
      localidad: 'Ushuaia',
      provincia: 'Tierra del Fuego',
      abierto: true,
    });
    canastas.obtenerCanastaParaCheckout.mockResolvedValue(detalle);
    franjas.listarParaCheckout.mockResolvedValue([]);
    franjas.validarParaCheckout.mockResolvedValue({
      id: franjaId,
      diaSemana: 2,
      horaInicio: '10:00',
      horaFin: '11:00',
      fechaRetiro: '2026-11-24',
      etiqueta: 'Mar 24/11 · 10:00 a 11:00',
    });

    tx.canasta.findUnique.mockResolvedValue({ idCanasta: canastaId });
    tx.producto.updateMany.mockResolvedValue({ count: 1 });
    tx.canasta.delete.mockResolvedValue({});
    tx.pedido.create.mockResolvedValue({
      id_pedido: '77777777-7777-4777-8777-777777777777',
      codigoAlfanumerico: 'ABCD2345',
      total: new Prisma.Decimal('9411.78'),
    });
  });

  describe('obtenerResumen', () => {
    it('arma el resumen con montos como string y las franjas del comercio', async () => {
      const resultado = await service.obtenerResumen(usuarioId, comercioId);

      expect(resultado.comercio).toEqual({
        idComercio: comercioId,
        nombreFantasia: 'Almacén del Centro',
        direccion: 'Av. San Martín 123, Ushuaia, Tierra del Fuego',
        abierto: true,
      });
      expect(resultado.subtotal).toBe('9411.78');
      expect(resultado.total).toBe('9411.78');
      expect(resultado).not.toHaveProperty('tarifaServicio');
      expect(resultado.items[0]).toEqual(
        expect.objectContaining({
          productoId,
          cantidad: 2,
          precioUnitario: '4705.89',
          subtotal: '9411.78',
        }),
      );
    });

    it('devuelve 404 si el usuario no tiene canasta en ese comercio', async () => {
      prisma.canasta.findUnique.mockResolvedValue(null);

      await expect(
        service.obtenerResumen(usuarioId, comercioId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('pagar', () => {
    it('aprueba el pago, descuenta stock y vacía la canasta', async () => {
      pasarela.cobrar.mockResolvedValue({
        aprobado: true,
        nroComprobante: 'SIM-20261117-ABCD1234',
        mpPaymentId: null,
        comisionMp: new Prisma.Decimal('611.77'),
      });

      const resultado = await service.pagar(usuarioId, {
        comercioId,
        franjaHorarioId: franjaId,
        resultadoPagoSimulado: 'APROBADO',
      });

      expect(resultado).toEqual({
        idPedido: '77777777-7777-4777-8777-777777777777',
        codigoAlfanumerico: 'ABCD2345',
        estado: 'PENDIENTE_DE_RETIRO',
        total: '9411.78',
      });

      expect(franjas.validarParaCheckout).toHaveBeenCalledWith(
        comercioId,
        franjaId,
      );
      expect(tx.producto.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ stock: { gte: 2 } }),
          data: { stock: { decrement: 2 } },
        }),
      );

      const data = tx.pedido.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        estado: 'PENDIENTE_DE_RETIRO',
        formaPago: 'SIMULADO',
        franjaHorarioId: franjaId,
        subtotal: expect.anything(),
        tarifa_servicio: expect.anything(),
        total: expect.anything(),
      });
      expect(data.tarifa_servicio.toString()).toBe('200');
      expect(data.items.create).toHaveLength(1);
      expect(data.pagos.create.estado).toBe('PAGADO');
      expect(data.pagos.create.splits.create).toHaveLength(2);

      const [splitComercio, splitMarketplace] =
        data.pagos.create.splits.create;
      expect(splitComercio.recipientType).toBe('COMERCIO');
      expect(splitComercio.monto.toString()).toBe('2000');
      expect(splitMarketplace.recipientType).toBe('MARKETPLACE');
      // 9411.78 - 611.77 - 2000.00 = 6800.01
      expect(splitMarketplace.monto.toString()).toBe('6800.01');

      expect(tx.canasta.delete).toHaveBeenCalledWith({
        where: { idCanasta: canastaId },
      });
    });

    it('rechaza el pago con 402 sin descontar stock ni vaciar la canasta', async () => {
      pasarela.cobrar.mockResolvedValue({
        aprobado: false,
        nroComprobante: null,
        mpPaymentId: null,
        comisionMp: new Prisma.Decimal(0),
      });

      const promesa = service.pagar(usuarioId, {
        comercioId,
        franjaHorarioId: franjaId,
        resultadoPagoSimulado: 'RECHAZADO',
      });

      await expect(promesa).rejects.toBeInstanceOf(HttpException);
      await expect(promesa).rejects.toMatchObject({
        status: HttpStatus.PAYMENT_REQUIRED,
      });

      expect(tx.producto.updateMany).not.toHaveBeenCalled();
      expect(tx.canasta.delete).not.toHaveBeenCalled();
      // El cobro ocurre fuera de la transacción: un rechazo no toca la base.
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.pedido.create).not.toHaveBeenCalled();
    });

    it('revierte con 409 si el stock cambió antes de escribir', async () => {
      pasarela.cobrar.mockResolvedValue({
        aprobado: true,
        nroComprobante: 'SIM-20261117-ABCD1234',
        mpPaymentId: null,
        comisionMp: new Prisma.Decimal('611.77'),
      });
      tx.producto.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.pagar(usuarioId, {
          comercioId,
          franjaHorarioId: franjaId,
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(tx.pedido.create).not.toHaveBeenCalled();
      expect(tx.canasta.delete).not.toHaveBeenCalled();
    });

    it('no deja pagar si la franja no es válida', async () => {
      franjas.validarParaCheckout.mockRejectedValue(
        new BadRequestExceptionProbe(),
      );

      await expect(
        service.pagar(usuarioId, {
          comercioId,
          franjaHorarioId: '99999999-9999-4999-8999-999999999999',
        }),
      ).rejects.toBeInstanceOf(BadRequestExceptionProbe);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('idempotencia del checkout', () => {
    const clave = 'clave-idempotente-1';
    const pedidoPrevio = {
      id_pedido: '88888888-8888-4888-8888-888888888888',
      usuarioId,
      comercioId,
      codigoAlfanumerico: 'PREV1234',
      total: new Prisma.Decimal('100.00'),
      estado: 'PENDIENTE_DE_RETIRO',
    };

    it('devuelve el pedido previo del mismo usuario y comercio sin cobrar de nuevo', async () => {
      prisma.pedido.findUnique.mockResolvedValue(pedidoPrevio);

      const resultado = await service.pagar(usuarioId, {
        comercioId,
        franjaHorarioId: franjaId,
        idempotencyKey: clave,
      });

      expect(resultado).toEqual({
        idPedido: pedidoPrevio.id_pedido,
        codigoAlfanumerico: 'PREV1234',
        estado: 'PENDIENTE_DE_RETIRO',
        total: '100.00',
      });
      expect(pasarela.cobrar).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('devuelve el estado real del pedido previo, no un estado fijo', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        ...pedidoPrevio,
        estado: 'CANCELADO',
      });

      const resultado = await service.pagar(usuarioId, {
        comercioId,
        franjaHorarioId: franjaId,
        idempotencyKey: clave,
      });

      expect(resultado.estado).toBe('CANCELADO');
    });

    it('rechaza la clave si pertenece a otro usuario', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        ...pedidoPrevio,
        usuarioId: '99999999-9999-4999-8999-999999999999',
      });

      await expect(
        service.pagar(usuarioId, {
          comercioId,
          franjaHorarioId: franjaId,
          idempotencyKey: clave,
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(pasarela.cobrar).not.toHaveBeenCalled();
    });

    it('rechaza la clave si pertenece a otro comercio', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        ...pedidoPrevio,
        comercioId: '99999999-9999-4999-8999-999999999999',
      });

      await expect(
        service.pagar(usuarioId, {
          comercioId,
          franjaHorarioId: franjaId,
          idempotencyKey: clave,
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(pasarela.cobrar).not.toHaveBeenCalled();
    });

    it('ante P2002, recupera solo el pedido del mismo usuario y comercio', async () => {
      pasarela.cobrar.mockResolvedValue({
        aprobado: true,
        nroComprobante: 'SIM-20261117-ABCD1234',
        mpPaymentId: null,
        comisionMp: new Prisma.Decimal('611.77'),
      });
      prisma.$transaction.mockRejectedValueOnce(conflictoDeIdempotencia());
      prisma.pedido.findUnique.mockResolvedValue(pedidoPrevio);

      const resultado = await service.pagar(usuarioId, {
        comercioId,
        franjaHorarioId: franjaId,
        idempotencyKey: clave,
      });

      expect(resultado.idPedido).toBe(pedidoPrevio.id_pedido);
    });

    it('ante P2002, no devuelve el pedido de otro usuario', async () => {
      pasarela.cobrar.mockResolvedValue({
        aprobado: true,
        nroComprobante: 'SIM-20261117-ABCD1234',
        mpPaymentId: null,
        comisionMp: new Prisma.Decimal('611.77'),
      });
      prisma.$transaction.mockRejectedValueOnce(conflictoDeIdempotencia());
      prisma.pedido.findUnique.mockResolvedValue({
        ...pedidoPrevio,
        usuarioId: '99999999-9999-4999-8999-999999999999',
      });

      await expect(
        service.pagar(usuarioId, {
          comercioId,
          franjaHorarioId: franjaId,
          idempotencyKey: clave,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});

function conflictoDeIdempotencia() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.0.0',
    meta: { target: ['idempotency_key'] },
  });
}

/** Excepción centinela: solo verifica que se corta antes de la transacción. */
class BadRequestExceptionProbe extends Error {}
