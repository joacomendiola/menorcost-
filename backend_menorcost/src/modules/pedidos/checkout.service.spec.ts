import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { ErrorPagoMercadoPago } from '../pagos-mercadopago/error-pago-mercadopago.js';
import { urlCheckoutDeOrden } from '../pagos-mercadopago/orden-mercadopago.js';
import {
  liberarStockDePedido,
  reservarStock,
} from '../pagos-mercadopago/reserva-stock.js';
import { CheckoutService } from './checkout.service.js';

vi.mock('../pagos-mercadopago/reserva-stock.js', () => ({
  reservarStock: vi.fn(),
  liberarStockDePedido: vi.fn(),
}));

const usuarioId = '11111111-1111-4111-8111-111111111111';
const comercioId = '22222222-2222-4222-8222-222222222222';
const canastaId = '33333333-3333-4333-8333-333333333333';
const franjaId = '44444444-4444-4444-8444-444444444444';
const productoId = '55555555-5555-4555-8555-555555555555';
const pedidoId = '66666666-6666-4666-8666-666666666666';
const pagoId = '77777777-7777-4777-8777-777777777777';

const dto = { comercioId, franjaHorarioId: franjaId, idempotencyKey: 'clave-1' };

const detalle = {
  idCanasta: canastaId,
  comercioId,
  comercio: { nombreFantasia: 'Almacén del Centro' },
  subtotal: '9411.78',
  items: [
    {
      idCanastaItem: '88888888-8888-4888-8888-888888888888',
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

function pedidoPendiente(sobrescribir: Record<string, unknown> = {}) {
  return {
    id_pedido: pedidoId,
    nroPedido: 'MC-20261122-ABC123',
    usuarioId,
    comercioId,
    estado: 'PENDIENTE_PAGO' as const,
    codigoAlfanumerico: 'ABC123XY',
    total: new Prisma.Decimal('9411.78'),
    tarifa_servicio: new Prisma.Decimal('200.00'),
    fechaExpiracionPago: new Date(Date.now() + 30 * 60 * 1000),
    comercio: { nombreFantasia: 'Almacén del Centro' },
    usuario: { email: 'cliente@menorcost.test' },
    items: [
      {
        nombreHistorico: 'Yogur entero',
        cantidad: 2,
        precio_unitario: new Prisma.Decimal('4705.89'),
      },
    ],
    pagos: [] as unknown[],
    ...sobrescribir,
  };
}

describe('CheckoutService', () => {
  const tx = {
    pedido: { create: vi.fn() },
    pago: { create: vi.fn(), update: vi.fn() },
    canasta: { delete: vi.fn() },
  };
  const prisma = {
    canasta: { findUnique: vi.fn() },
    comercio: { findUnique: vi.fn() },
    usuario: { findUnique: vi.fn() },
    pedido: { findFirst: vi.fn(), findUnique: vi.fn() },
    pago: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(),
  };
  const canastas = { obtenerCanastaParaCheckout: vi.fn() };
  const franjas = { listarParaCheckout: vi.fn(), validarParaCheckout: vi.fn() };
  const credenciales = { obtenerCredencialActiva: vi.fn() };
  const mercadoPago = { crearOrden: vi.fn(), obtenerOrden: vi.fn() };
  const config = {
    minutosExpiracion: vi.fn(() => 60),
    urlsRetorno: vi.fn((id: string) => ({
      exito: `https://front.test/ok?idPedido=${id}`,
      fallo: `https://front.test/error?idPedido=${id}`,
      pendiente: `https://front.test/pendiente?idPedido=${id}`,
    })),
    urlWebhook: vi.fn(() => 'https://api.test/notificaciones-mercadopago'),
  };

  const service = new CheckoutService(
    prisma as never,
    canastas as never,
    franjas as never,
    credenciales as never,
    mercadoPago as never,
    config as never,
  );

  beforeEach(() => {
    vi.resetAllMocks();

    prisma.$transaction.mockImplementation(
      (operacion: (cliente: typeof tx) => Promise<unknown>) => operacion(tx),
    );
    prisma.canasta.findUnique.mockResolvedValue({ idCanasta: canastaId });
    prisma.comercio.findUnique.mockResolvedValue({
      nombreFantasia: 'Almacén del Centro',
      calle: 'Av. San Martín',
      numero: '123',
      piso: null,
      localidad: 'Ushuaia',
      provincia: 'Tierra del Fuego',
      abierto: true,
    });
    prisma.usuario.findUnique.mockResolvedValue({
      email: 'cliente@menorcost.test',
    });
    canastas.obtenerCanastaParaCheckout.mockResolvedValue(detalle);
    franjas.listarParaCheckout.mockResolvedValue([]);
    franjas.validarParaCheckout.mockResolvedValue({ id: franjaId });
    credenciales.obtenerCredencialActiva.mockResolvedValue({
      idCredencial: 'credencial-1',
      accessToken: 'token-vendedor',
    });
    mercadoPago.crearOrden.mockResolvedValue({
      id: 'ORD-1',
      status: 'created',
      status_detail: 'created',
      checkout_url: 'https://mp.test/ORD-1',
    });
    mercadoPago.obtenerOrden.mockResolvedValue({
      id: 'ORD-1',
      status: 'created',
      checkout_url: 'https://mp.test/ORD-1',
    });
    tx.pedido.create.mockResolvedValue({
      id_pedido: pedidoId,
      nroPedido: 'MC-20261122-ABC123',
      estado: 'PENDIENTE_PAGO',
    });
    tx.pago.create.mockResolvedValue({ idPago: pagoId });
    tx.canasta.delete.mockResolvedValue({});
    prisma.pago.create.mockResolvedValue({ idPago: 'pago-nuevo' });
    vi.mocked(reservarStock).mockResolvedValue(undefined);
    vi.mocked(liberarStockDePedido).mockResolvedValue(true);
    config.minutosExpiracion.mockReturnValue(60);
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
      expect(resultado.items[0]).toEqual(
        expect.objectContaining({
          productoId,
          cantidad: 2,
          precioUnitario: '4705.89',
          subtotal: '9411.78',
        }),
      );
      expect(franjas.listarParaCheckout).toHaveBeenCalledWith(comercioId);
    });

    it('devuelve 404 si el usuario no tiene canasta en ese comercio', async () => {
      prisma.canasta.findUnique.mockResolvedValue(null);

      await expect(
        service.obtenerResumen(usuarioId, comercioId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('pagar', () => {
    it('reserva stock, crea el pedido pendiente y devuelve la URL de Mercado Pago', async () => {
      const resultado = await service.pagar(usuarioId, dto);

      expect(resultado).toEqual({
        idPedido: pedidoId,
        estado: 'PENDIENTE_PAGO',
        urlRedireccion: 'https://mp.test/ORD-1',
      });

      expect(reservarStock).toHaveBeenCalledWith(tx, [
        { productoId, cantidad: 2 },
      ]);

      const pedido = tx.pedido.create.mock.calls[0][0].data;
      expect(pedido.estado).toBe('PENDIENTE_PAGO');
      expect(pedido.idempotencyKey).toBe('clave-1');
      expect(pedido.franjaHorarioId).toBe(franjaId);
      expect(pedido.total.toFixed(2)).toBe('9411.78');
      expect(pedido.tarifa_servicio.toFixed(2)).toBe('200.00');
      expect(pedido.items.create).toHaveLength(1);
      expect(pedido.fechaExpiracionPago.getTime() - Date.now()).toBeGreaterThan(
        59 * 60 * 1000,
      );

      expect(tx.canasta.delete).toHaveBeenCalledWith({
        where: { idCanasta: canastaId },
      });

      const [token, cuerpo, clave, comercio] =
        mercadoPago.crearOrden.mock.calls[0];
      expect(token).toBe('token-vendedor');
      expect(cuerpo.total_amount).toBe('9411.78');
      expect(cuerpo.marketplace_fee).toBe('200.00');
      expect(cuerpo.external_reference).toBe(pedidoId);
      expect(cuerpo.config.online.success_url).toContain(pedidoId);
      expect(cuerpo.config.online.callback_url).toBe(
        'https://api.test/notificaciones-mercadopago',
      );
      expect(clave).toBe(pagoId);
      expect(comercio).toBe(comercioId);

      expect(prisma.pago.update).toHaveBeenCalledWith({
        where: { idPago: pagoId },
        data: {
          mpOrderId: 'ORD-1',
          mpCheckoutUrl: 'https://mp.test/ORD-1',
          mpStatus: 'created',
          mpStatusDetail: 'created',
        },
      });
      expect(liberarStockDePedido).not.toHaveBeenCalled();
    });

    it('si Mercado Pago falla cancela el pedido y libera el stock en el acto', async () => {
      mercadoPago.crearOrden.mockRejectedValue(
        new ErrorPagoMercadoPago('mp_no_disponible', 'MP caído'),
      );

      await expect(service.pagar(usuarioId, dto)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );

      expect(liberarStockDePedido).toHaveBeenCalledWith(
        tx,
        pedidoId,
        'PAGO_NO_INICIADO',
      );
      expect(tx.pago.update).toHaveBeenCalledWith({
        where: { idPago: pagoId },
        data: { estado: 'RECHAZADO' },
      });
    });

    it('si la credencial está vencida responde 400 sin reservar nada', async () => {
      credenciales.obtenerCredencialActiva.mockRejectedValue(
        new ErrorPagoMercadoPago('credencial_invalida', 'Vinculación vencida'),
      );

      await expect(service.pagar(usuarioId, dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(mercadoPago.crearOrden).not.toHaveBeenCalled();
    });

    it('con la misma clave de idempotencia devuelve el pedido ya creado', async () => {
      prisma.pedido.findFirst.mockResolvedValue({
        id_pedido: pedidoId,
        estado: 'PENDIENTE_PAGO',
      });
      prisma.pago.findFirst.mockResolvedValue({ mpOrderId: 'ORD-9' });

      const resultado = await service.pagar(usuarioId, dto);

      expect(resultado).toEqual({
        idPedido: pedidoId,
        estado: 'PENDIENTE_PAGO',
        urlRedireccion: urlCheckoutDeOrden('ORD-9'),
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(mercadoPago.crearOrden).not.toHaveBeenCalled();
    });

    it('devuelve 404 si no hay canasta activa', async () => {
      prisma.canasta.findUnique.mockResolvedValue(null);

      await expect(service.pagar(usuarioId, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('reintentar', () => {
    it('reutiliza la order vigente con el checkout_url que devuelve MP', async () => {
      prisma.pedido.findUnique.mockResolvedValue(
        pedidoPendiente({
          pagos: [{ idPago: pagoId, estado: 'PENDIENTE', mpOrderId: 'ORD-1' }],
        }),
      );

      const resultado = await service.reintentar(usuarioId, pedidoId);

      expect(mercadoPago.obtenerOrden).toHaveBeenCalledWith(
        'token-vendedor',
        'ORD-1',
      );
      expect(resultado.urlRedireccion).toBe('https://mp.test/ORD-1');
      expect(prisma.pago.create).not.toHaveBeenCalled();
      expect(mercadoPago.crearOrden).not.toHaveBeenCalled();
    });

    it('crea una order nueva si la anterior ya no está pagable', async () => {
      prisma.pedido.findUnique.mockResolvedValue(
        pedidoPendiente({
          pagos: [{ idPago: pagoId, estado: 'PENDIENTE', mpOrderId: 'ORD-1' }],
        }),
      );
      mercadoPago.obtenerOrden.mockResolvedValue({
        id: 'ORD-1',
        status: 'expired',
        checkout_url: 'https://mp.test/ORD-1',
      });

      const resultado = await service.reintentar(usuarioId, pedidoId);

      expect(prisma.pago.update).toHaveBeenCalledWith({
        where: { idPago: pagoId },
        data: { estado: 'RECHAZADO' },
      });
      expect(prisma.pago.create).toHaveBeenCalledOnce();
      expect(mercadoPago.crearOrden).toHaveBeenCalledOnce();
      expect(resultado.urlRedireccion).toBe('https://mp.test/ORD-1');
    });

    it('crea una order nueva si MP no puede consultar la anterior', async () => {
      prisma.pedido.findUnique.mockResolvedValue(
        pedidoPendiente({
          pagos: [{ idPago: pagoId, estado: 'PENDIENTE', mpOrderId: 'ORD-1' }],
        }),
      );
      mercadoPago.obtenerOrden.mockRejectedValue(new Error('MP caído'));

      const resultado = await service.reintentar(usuarioId, pedidoId);

      expect(prisma.pago.update).toHaveBeenCalledWith({
        where: { idPago: pagoId },
        data: { estado: 'RECHAZADO' },
      });
      expect(prisma.pago.create).toHaveBeenCalledOnce();
      expect(mercadoPago.crearOrden).toHaveBeenCalledOnce();
      expect(resultado.urlRedireccion).toBe('https://mp.test/ORD-1');
    });

    it('abre un intento nuevo cuando el anterior quedó rechazado', async () => {
      prisma.pedido.findUnique.mockResolvedValue(
        pedidoPendiente({
          pagos: [
            { idPago: 'pago-viejo', estado: 'RECHAZADO', mpOrderId: 'ORD-0' },
          ],
        }),
      );

      const resultado = await service.reintentar(usuarioId, pedidoId);

      expect(prisma.pago.create).toHaveBeenCalledOnce();
      expect(mercadoPago.crearOrden.mock.calls[0][2]).toBe('pago-nuevo');
      expect(resultado.urlRedireccion).toBe('https://mp.test/ORD-1');
      expect(liberarStockDePedido).not.toHaveBeenCalled();
    });

    it('si venció la reserva libera el stock y avisa', async () => {
      prisma.pedido.findUnique.mockResolvedValue(
        pedidoPendiente({ fechaExpiracionPago: new Date(Date.now() - 1000) }),
      );

      await expect(
        service.reintentar(usuarioId, pedidoId),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(liberarStockDePedido).toHaveBeenCalledWith(
        tx,
        pedidoId,
        'EXPIRADO',
      );
      expect(mercadoPago.crearOrden).not.toHaveBeenCalled();
    });

    it('no permite reintentar un pedido de otro usuario', async () => {
      prisma.pedido.findUnique.mockResolvedValue(
        pedidoPendiente({ usuarioId: 'otro-usuario' }),
      );

      await expect(
        service.reintentar(usuarioId, pedidoId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('no permite reintentar un pedido que ya no está pendiente', async () => {
      prisma.pedido.findUnique.mockResolvedValue(
        pedidoPendiente({ estado: 'PENDIENTE_DE_RETIRO' }),
      );

      await expect(
        service.reintentar(usuarioId, pedidoId),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(mercadoPago.crearOrden).not.toHaveBeenCalled();
    });

    it('si Mercado Pago falla conserva la reserva para volver a intentar', async () => {
      prisma.pedido.findUnique.mockResolvedValue(pedidoPendiente());
      mercadoPago.crearOrden.mockRejectedValue(
        new ErrorPagoMercadoPago('mp_no_disponible', 'MP caído'),
      );

      await expect(
        service.reintentar(usuarioId, pedidoId),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(liberarStockDePedido).not.toHaveBeenCalled();
    });
  });

  describe('obtenerEstado', () => {
    it('expone la URL de pago mientras el pedido sigue pendiente', async () => {
      prisma.pedido.findUnique.mockResolvedValue(
        pedidoPendiente({
          pagos: [{ estado: 'PENDIENTE', mpOrderId: 'ORD-1' }],
        }),
      );

      const estado = await service.obtenerEstado(usuarioId, pedidoId);

      expect(estado).toEqual({
        idPedido: pedidoId,
        estado: 'PENDIENTE_PAGO',
        pagoEstado: 'PENDIENTE',
        codigoAlfanumerico: 'ABC123XY',
        urlRedireccion: urlCheckoutDeOrden('ORD-1'),
      });
    });

    it('usa el checkout_url guardado en vez de reconstruirlo', async () => {
      prisma.pedido.findUnique.mockResolvedValue(
        pedidoPendiente({
          pagos: [
            {
              estado: 'PENDIENTE',
              mpOrderId: 'ORD-1',
              mpCheckoutUrl: 'https://mp.test/checkout?order_id=ORD-1&pref_id=P-1',
            },
          ],
        }),
      );

      const estado = await service.obtenerEstado(usuarioId, pedidoId);

      expect(estado.urlRedireccion).toBe(
        'https://mp.test/checkout?order_id=ORD-1&pref_id=P-1',
      );
    });

    it('no expone el checkout después del vencimiento de la reserva', async () => {
      prisma.pedido.findUnique.mockResolvedValue(
        pedidoPendiente({
          fechaExpiracionPago: new Date(Date.now() - 1000),
          pagos: [{ estado: 'PENDIENTE', mpOrderId: 'ORD-1' }],
        }),
      );

      const estado = await service.obtenerEstado(usuarioId, pedidoId);

      expect(estado.urlRedireccion).toBeNull();
    });

    it('una vez pagado no expone más el checkout', async () => {
      prisma.pedido.findUnique.mockResolvedValue(
        pedidoPendiente({
          estado: 'PENDIENTE_DE_RETIRO',
          pagos: [{ estado: 'PAGADO', mpOrderId: 'ORD-1' }],
        }),
      );

      const estado = await service.obtenerEstado(usuarioId, pedidoId);

      expect(estado.estado).toBe('PENDIENTE_DE_RETIRO');
      expect(estado.pagoEstado).toBe('PAGADO');
      expect(estado.urlRedireccion).toBeNull();
    });
  });
});
