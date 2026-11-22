import { createHmac } from 'node:crypto';
import { ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { ErrorPagoMercadoPago } from '../pagos-mercadopago/error-pago-mercadopago.js';
import { InvalidWebhookSignatureError } from './firma-webhook-mercadopago.js';
import { NotificacionesMercadoPagoService } from './notificaciones-mercadopago.service.js';

const SECRETO = 'secreto-del-panel-de-webhooks';
const ORDER_ID = 'ORD-1';

function pedidoDePrueba(estado = 'PENDIENTE_PAGO') {
  return {
    id_pedido: 'pedido-1',
    usuarioId: 'usuario-1',
    comercioId: 'comercio-1',
    estado,
    codigoAlfanumerico: 'ABC123XY',
    total: new Prisma.Decimal('1171.50'),
    tarifa_servicio: new Prisma.Decimal('100.00'),
    items: [
      {
        precioBaseNetoAplicado: new Prisma.Decimal('1000.00'),
        cantidad: 1,
      },
    ],
  };
}

function pagoDePrueba(pedido = pedidoDePrueba()) {
  return { idPago: 'pago-1', estado: 'PENDIENTE', credencialId: 'cred-1', pedido };
}

function ordenAprobada() {
  return {
    id: ORDER_ID,
    status: 'processed',
    status_detail: 'accredited',
    transactions: { payments: [{ id: 'PAY-1', status: 'approved' }] },
  };
}

function encabezadosValidos() {
  const ts = Date.now();
  const manifiesto = `id:${ORDER_ID};request-id:req-1;ts:${ts};`;
  const v1 = createHmac('sha256', SECRETO).update(manifiesto).digest('hex');

  return { xSignature: `ts=${ts},v1=${v1}`, xRequestId: 'req-1' };
}

const query = { 'data.id': ORDER_ID, type: 'order' };
const cuerpo = {
  action: 'order.processed',
  type: 'order',
  data: { id: ORDER_ID, external_reference: 'pedido-1' },
};

describe('NotificacionesMercadoPagoService', () => {
  const tx = {
    pago: { update: vi.fn() },
    pedido: { updateMany: vi.fn() },
    splitPago: { createMany: vi.fn() },
  };
  const prisma = {
    notificacionMercadoPago: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    pago: { findUnique: vi.fn(), update: vi.fn() },
    pedido: { findUnique: vi.fn() },
    notificacion: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const credenciales = { obtenerCredencialActiva: vi.fn() };
  const mercadoPago = { obtenerOrden: vi.fn() };
  const config = { secretoWebhook: vi.fn(() => SECRETO) };

  const servicio = new NotificacionesMercadoPagoService(
    prisma as never,
    credenciales as never,
    mercadoPago as never,
    config as never,
  );

  beforeEach(() => {
    vi.resetAllMocks();
    config.secretoWebhook.mockReturnValue(SECRETO);

    prisma.notificacionMercadoPago.findUnique.mockResolvedValue(null);
    prisma.notificacionMercadoPago.create.mockResolvedValue({ id: 'notif-1' });
    prisma.notificacionMercadoPago.update.mockResolvedValue({});
    prisma.pago.findUnique.mockResolvedValue(pagoDePrueba());
    prisma.pago.update.mockResolvedValue({});
    prisma.notificacion.create.mockResolvedValue({});
    credenciales.obtenerCredencialActiva.mockResolvedValue({
      idCredencial: 'cred-1',
      accessToken: 'token-vendedor',
    });
    mercadoPago.obtenerOrden.mockResolvedValue(ordenAprobada());
    tx.pedido.updateMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation(
      (operacion: (cliente: typeof tx) => Promise<unknown>) => operacion(tx),
    );
  });

  it('confirma el pago: PAGADO + pedido a retiro + splits + aviso al cliente', async () => {
    const resultado = await servicio.procesar(query, cuerpo, encabezadosValidos());

    expect(resultado).toEqual({
      recibida: true,
      procesada: true,
      resultado: 'pagado',
    });
    expect(mercadoPago.obtenerOrden).toHaveBeenCalledWith(
      'token-vendedor',
      ORDER_ID,
    );

    const actualizacionPago = tx.pago.update.mock.calls[0][0];
    expect(actualizacionPago.data.estado).toBe('PAGADO');
    expect(actualizacionPago.data.mpPaymentId).toBe('PAY-1');
    expect(actualizacionPago.data.comisionMp.toFixed(2)).toBe('71.50');

    expect(tx.pedido.updateMany).toHaveBeenCalledWith({
      where: { id_pedido: 'pedido-1', estado: 'PENDIENTE_PAGO' },
      data: { estado: 'PENDIENTE_DE_RETIRO' },
    });

    const splits = tx.splitPago.createMany.mock.calls[0][0];
    expect(splits.skipDuplicates).toBe(true);
    expect(splits.data).toHaveLength(2);
    expect(splits.data[0].recipientType).toBe('MARKETPLACE');
    expect(splits.data[0].monto.toFixed(2)).toBe('100.00');
    expect(splits.data[1].recipientType).toBe('COMERCIO');
    expect(splits.data[1].monto.toFixed(2)).toBe('1000.00');

    expect(prisma.notificacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usuarioId: 'usuario-1',
        tipo: 'PEDIDO_PAGADO',
      }),
    });
    expect(prisma.notificacionMercadoPago.update).toHaveBeenLastCalledWith({
      where: { id: 'notif-1' },
      data: { procesadaEn: expect.any(Date), error: null },
    });
  });

  it('no vuelve a procesar una notificación ya procesada', async () => {
    prisma.notificacionMercadoPago.findUnique.mockResolvedValue({
      id: 'notif-1',
      procesadaEn: new Date(),
    });

    const resultado = await servicio.procesar(query, cuerpo, encabezadosValidos());

    expect(resultado.duplicada).toBe(true);
    expect(mercadoPago.obtenerOrden).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('pago rechazado: marca el intento y deja el pedido pendiente para reintento', async () => {
    mercadoPago.obtenerOrden.mockResolvedValue({
      id: ORDER_ID,
      status: 'created',
      status_detail: 'cc_rejected_other_reason',
      transactions: { payments: [{ id: 'PAY-2', status: 'rejected' }] },
    });

    const resultado = await servicio.procesar(query, cuerpo, encabezadosValidos());

    expect(resultado.resultado).toBe('rechazado');
    expect(prisma.pago.update).toHaveBeenCalledWith({
      where: { idPago: 'pago-1' },
      data: {
        estado: 'RECHAZADO',
        mpStatus: 'created',
        mpStatusDetail: 'cc_rejected_other_reason',
      },
    });
    expect(tx.pedido.updateMany).not.toHaveBeenCalled();
    expect(tx.splitPago.createMany).not.toHaveBeenCalled();
  });

  it('order aún pendiente: solo guarda el estado crudo de MP', async () => {
    mercadoPago.obtenerOrden.mockResolvedValue({
      id: ORDER_ID,
      status: 'action_required',
      status_detail: 'pending_challenge',
      transactions: { payments: [] },
    });

    const resultado = await servicio.procesar(query, cuerpo, encabezadosValidos());

    expect(resultado.resultado).toBe('pendiente');
    expect(prisma.pago.update).toHaveBeenCalledWith({
      where: { idPago: 'pago-1' },
      data: { mpStatus: 'action_required', mpStatusDetail: 'pending_challenge' },
    });
    expect(tx.pedido.updateMany).not.toHaveBeenCalled();
  });

  it('pago tardío sobre pedido cancelado: registra el cobro sin reabrir ni avisar', async () => {
    prisma.pago.findUnique.mockResolvedValue(
      pagoDePrueba(pedidoDePrueba('CANCELADO')),
    );

    const resultado = await servicio.procesar(query, cuerpo, encabezadosValidos());

    expect(resultado.resultado).toBe('pagado');
    expect(tx.pago.update).toHaveBeenCalled();
    expect(tx.pedido.updateMany).not.toHaveBeenCalled();
    expect(tx.splitPago.createMany).toHaveBeenCalled();
    expect(prisma.notificacion.create).not.toHaveBeenCalled();
  });

  it('si no encuentra el pedido registra el error y no llama a MP', async () => {
    prisma.pago.findUnique.mockResolvedValue(null);
    prisma.pedido.findUnique.mockResolvedValue(null);

    const resultado = await servicio.procesar(query, cuerpo, encabezadosValidos());

    expect(resultado).toMatchObject({ procesada: false, resultado: 'error' });
    expect(mercadoPago.obtenerOrden).not.toHaveBeenCalled();
    expect(prisma.notificacionMercadoPago.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: {
        error: expect.stringContaining('No se encontró pedido'),
        procesadaEn: expect.any(Date),
      },
    });
  });

  it('si Mercado Pago está caído deja la notificación abierta y responde 503', async () => {
    mercadoPago.obtenerOrden.mockRejectedValue(
      new ErrorPagoMercadoPago('mp_no_disponible', 'MP caído'),
    );

    await expect(
      servicio.procesar(query, cuerpo, encabezadosValidos()),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(prisma.notificacionMercadoPago.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: { error: 'MP caído' },
    });
  });

  it('una firma inválida no registra ni procesa nada', async () => {
    await expect(
      servicio.procesar(query, cuerpo, {
        xSignature: 'ts=1,v1=firma-trucha',
        xRequestId: 'req-1',
      }),
    ).rejects.toThrow(InvalidWebhookSignatureError);

    expect(prisma.notificacionMercadoPago.findUnique).not.toHaveBeenCalled();
    expect(mercadoPago.obtenerOrden).not.toHaveBeenCalled();
  });
});
