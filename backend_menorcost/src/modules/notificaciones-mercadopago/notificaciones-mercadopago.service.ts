import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  ClienteMercadoPago,
  type RespuestaOrdenMp,
} from '../pagos-mercadopago/cliente-mercadopago.js';
import { ConfiguracionPagoPedido } from '../pagos-mercadopago/configuracion-pago-pedido.js';
import { CredencialMercadoPagoService } from '../pagos-mercadopago/credencial-mercadopago.service.js';
import { ErrorPagoMercadoPago } from '../pagos-mercadopago/error-pago-mercadopago.js';
import { notificarPedido } from '../pedidos/pedido-notificaciones.js';
import type {
  CuerpoNotificacionMercadoPago,
  NotificacionMercadoPagoQueryDto,
} from './dto/notificacion-mercadopago.dto.js';
import {
  resultadoDeOrden,
  ultimoPagoDeOrden,
  type ResultadoOrdenMp,
} from './estados-mercadopago.js';
import {
  validarFirmaWebhook,
  type EncabezadosFirmaMp,
} from './firma-webhook-mercadopago.js';

export interface RecepcionNotificacion {
  recibida: boolean;
  duplicada?: boolean;
  procesada?: boolean;
  resultado?: ResultadoOrdenMp | 'ignorada' | 'error';
}

const PEDIDO_PARA_CONFIRMAR = {
  id_pedido: true,
  usuarioId: true,
  comercioId: true,
  estado: true,
  codigoAlfanumerico: true,
  total: true,
  tarifa_servicio: true,
  items: {
    select: { precioBaseNetoAplicado: true, cantidad: true },
  },
} as const;

type PedidoParaConfirmar = Prisma.PedidoGetPayload<{
  select: typeof PEDIDO_PARA_CONFIRMAR;
}>;

type PagoParaConfirmar = {
  idPago: string;
  estado: 'PENDIENTE' | 'PAGADO' | 'RECHAZADO' | 'REEMBOLSADO';
  credencialId: string | null;
};

interface PagoYPedido {
  pago: PagoParaConfirmar;
  pedido: PedidoParaConfirmar;
}

/**
 * Webhook de Mercado Pago (tópico `order`).
 *
 * Secuencia: validar firma → registrar la notificación (idempotencia por
 * `claveUnica`) → consultar la Order real en MP (la notificación es solo un
 * aviso) → confirmar o marcar el intento.
 *
 * Nunca se confía en el body para acreditar: el estado sale de
 * `GET /v1/orders/{id}` con el token del vendedor.
 */
@Injectable()
export class NotificacionesMercadoPagoService {
  private readonly logger = new Logger(NotificacionesMercadoPagoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credenciales: CredencialMercadoPagoService,
    private readonly mercadoPago: ClienteMercadoPago,
    private readonly config: ConfiguracionPagoPedido,
  ) {}

  async procesar(
    query: NotificacionMercadoPagoQueryDto,
    cuerpo: CuerpoNotificacionMercadoPago = {},
    encabezados: EncabezadosFirmaMp,
  ): Promise<RecepcionNotificacion> {
    // MP firma el `data.id` de la query. No se usa el body para autenticar ni
    // para decidir qué recurso consultar.
    const orderId = query.dataId;
    const topico = query.type ?? 'order';

    validarFirmaWebhook(encabezados, orderId, this.config.secretoWebhook());

    if (!orderId) {
      throw new BadRequestException('La notificación no trae data.id.');
    }

    const claveUnica = this.claveUnica(topico, orderId, cuerpo);
    const registro = await this.registrar(
      claveUnica,
      topico,
      orderId,
      cuerpo,
      encabezados,
    );

    if (registro.duplicada) {
      return { recibida: true, duplicada: true };
    }

    const idNotificacion = registro.id as string;

    if (topico !== 'order') {
      await this.marcarProcesada(idNotificacion);
      return { recibida: true, procesada: true, resultado: 'ignorada' };
    }

    const localizado = await this.buscarPagoYPedido(
      orderId,
      cuerpo.data?.external_reference,
    );

    if (!localizado) {
      await this.marcarError(
        idNotificacion,
        `No se encontró pedido para la order ${orderId}.`,
        true,
      );
      return { recibida: true, procesada: false, resultado: 'error' };
    }

    let orden;
    try {
      const credencial = await this.credenciales.obtenerCredencialActiva(
        localizado.pedido.comercioId,
      );
      orden = await this.mercadoPago.obtenerOrden(
        credencial.accessToken,
        orderId,
      );
    } catch (error) {
      // Si Mercado Pago está caído conviene que reintente: no se cierra la
      // notificación y se responde 503. El resto no tiene sentido reintentar.
      const transitorio =
        error instanceof ErrorPagoMercadoPago &&
        error.codigo === 'mp_no_disponible';

      await this.marcarError(
        idNotificacion,
        this.describir(error),
        !transitorio,
      );

      if (transitorio) {
        throw new ServiceUnavailableException(
          'No pudimos confirmar el pago con Mercado Pago.',
        );
      }

      return { recibida: true, procesada: false, resultado: 'error' };
    }

    if (!this.ordenCorrespondeAlPedido(orden, orderId, localizado.pedido)) {
      await this.marcarError(
        idNotificacion,
        `La order ${orderId} no corresponde al pedido localizado.`,
        true,
      );
      return { recibida: true, procesada: false, resultado: 'error' };
    }

    const resultado = resultadoDeOrden(orden);

    let alerta: string | undefined;
    if (resultado === 'pagado') {
      alerta = await this.confirmarPago(
        localizado.pedido,
        localizado.pago,
        orden,
      );
    } else if (resultado === 'rechazado') {
      await this.marcarRechazado(localizado.pago, orden);
    } else {
      await this.prisma.pago.update({
        where: { idPago: localizado.pago.idPago },
        data: {
          mpStatus: orden.status ?? null,
          mpStatusDetail: orden.status_detail ?? null,
        },
      });
    }

    await this.marcarProcesada(idNotificacion, alerta);

    return { recibida: true, procesada: true, resultado };
  }

  /**
   * Idempotencia: una notificación ya procesada no se vuelve a consultar.
   * Una que quedó con error transitorio (`procesadaEn` vacío) sí se reprocesa.
   */
  private async registrar(
    claveUnica: string,
    topico: string,
    orderId: string,
    cuerpo: CuerpoNotificacionMercadoPago,
    encabezados: EncabezadosFirmaMp,
  ): Promise<{ id?: string; duplicada?: boolean }> {
    const existente = await this.prisma.notificacionMercadoPago.findUnique({
      where: { claveUnica },
      select: { id: true, procesadaEn: true },
    });

    if (existente?.procesadaEn) return { duplicada: true };
    if (existente) return { id: existente.id };

    try {
      const creada = await this.prisma.notificacionMercadoPago.create({
        data: {
          claveUnica,
          topico,
          accion: cuerpo.action ?? null,
          idRecurso: orderId,
          referenciaExterna: cuerpo.data?.external_reference ?? null,
          payload: cuerpo as Prisma.InputJsonValue,
          encabezados: {
            'x-signature': encabezados.xSignature ?? null,
            'x-request-id': encabezados.xRequestId ?? null,
          },
        },
        select: { id: true },
      });

      return { id: creada.id };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { duplicada: true };
      }

      throw error;
    }
  }

  /**
   * MP identifica de forma única cada notificación en el campo `id` del body.
   * El fallback mantiene la deduplicación para payloads incompletos.
   */
  private claveUnica(
    topico: string,
    orderId: string,
    cuerpo: CuerpoNotificacionMercadoPago,
  ): string {
    if (cuerpo.id !== undefined && cuerpo.id !== null) {
      return `evento:${topico}:${String(cuerpo.id)}`;
    }

    return `recurso:${topico}:${orderId}:${cuerpo.action ?? 'sin_accion'}`;
  }

  private async buscarPagoYPedido(
    orderId: string,
    referencia?: string,
  ): Promise<PagoYPedido | null> {
    const pago = await this.prisma.pago.findUnique({
      where: { mpOrderId: orderId },
      select: {
        idPago: true,
        estado: true,
        credencialId: true,
        pedido: { select: PEDIDO_PARA_CONFIRMAR },
      },
    });

    if (pago) return { pago, pedido: pago.pedido };

    // La referencia externa es el id del pedido: cubre el caso de una order
    // cuyo `mpOrderId` todavía no quedó persistido en el intento.
    if (!referencia) return null;

    const pedido = await this.prisma.pedido.findUnique({
      where: { id_pedido: referencia },
      select: {
        ...PEDIDO_PARA_CONFIRMAR,
        pagos: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { idPago: true, estado: true, credencialId: true },
        },
      },
    });

    const ultimoPago = pedido?.pagos[0];
    if (!pedido || !ultimoPago) return null;

    return { pago: ultimoPago, pedido };
  }

  /**
   * La consulta remota es la fuente de verdad. La referencia fue enviada al
   * crear la Order y debe apuntar al mismo pedido que se obtuvo localmente.
   */
  private ordenCorrespondeAlPedido(
    orden: RespuestaOrdenMp,
    orderId: string,
    pedido: PedidoParaConfirmar,
  ): boolean {
    if (orden.id && orden.id !== orderId) return false;

    return (
      !orden.external_reference ||
      orden.external_reference === pedido.id_pedido
    );
  }

  private async confirmarPago(
    pedido: PedidoParaConfirmar,
    pago: PagoParaConfirmar,
    orden: RespuestaOrdenMp,
  ): Promise<string | undefined> {
    const pagoMp = ultimoPagoDeOrden(orden);

    // La Orders API no expone el fee real de MP: se usa la comisión estimada
    // ya congelada en el pedido (gross-up de CU-1.08). Así el comercio recibe
    // su precio base neto y Menorcost su tarifa de servicio.
    const baseNeto = pedido.items.reduce(
      (acumulado, item) =>
        acumulado.plus(item.precioBaseNetoAplicado.mul(item.cantidad)),
      new Prisma.Decimal(0),
    );
    const estimada = pedido.total.minus(pedido.tarifa_servicio).minus(baseNeto);
    const comisionMp = estimada.isNegative()
      ? new Prisma.Decimal(0)
      : estimada.toDecimalPlaces(2);
    const netoComercio = pedido.total
      .minus(comisionMp)
      .minus(pedido.tarifa_servicio);

    let pedidoConfirmado = false;

    await this.prisma.$transaction(async (tx) => {
      await tx.pago.update({
        where: { idPago: pago.idPago },
        data: {
          estado: 'PAGADO',
          mpPaymentId: pagoMp?.id ? String(pagoMp.id) : null,
          comisionMp,
          paymentDate: new Date(),
          mpStatus: orden.status ?? null,
          mpStatusDetail: orden.status_detail ?? null,
        },
      });

      if (pedido.estado === 'PENDIENTE_PAGO') {
        const actualizado = await tx.pedido.updateMany({
          where: { id_pedido: pedido.id_pedido, estado: 'PENDIENTE_PAGO' },
          data: { estado: 'PENDIENTE_DE_RETIRO' },
        });
        pedidoConfirmado = actualizado.count === 1;
      }

      // `skipDuplicates` + unique (id_pago, recipient_type): splits una sola vez.
      await tx.splitPago.createMany({
        data: [
          {
            pagoId: pago.idPago,
            recipientType: 'MARKETPLACE',
            destinatarioId: null,
            credencialId: pago.credencialId,
            monto: pedido.tarifa_servicio,
          },
          {
            pagoId: pago.idPago,
            recipientType: 'COMERCIO',
            destinatarioId: pedido.comercioId,
            credencialId: pago.credencialId,
            monto: netoComercio,
          },
        ],
        skipDuplicates: true,
      });
    });

    if (pedidoConfirmado) {
      await notificarPedido(this.prisma, {
        usuarioId: pedido.usuarioId,
        tipo: 'PEDIDO_PAGADO',
        titulo: 'Pago confirmado',
        mensaje: `Tu pedido ${pedido.codigoAlfanumerico} ya está pago. Presentá el código QR en el comercio dentro de la franja elegida para retirarlo.`,
      });

      return undefined;
    }

    if (
      pedido.estado === 'CANCELADO' ||
      pedido.estado === 'CANCELADO_POR_FALTA_RETIRO'
    ) {
      // Pago tardío: se registra el cobro, pero NO se reabre el pedido ni se
      // repone stock. Queda la alerta para revisión manual.
      const alerta = `Pago tardío sobre pedido ${pedido.id_pedido} en estado ${pedido.estado}; order ${orden.id ?? 'sin_id'} acreditada sin reabrir el pedido.`;
      this.logger.warn(alerta);
      return alerta;
    }

    return undefined;
  }

  /** Rechazo: el pedido sigue pendiente y el cliente puede reintentar. */
  private async marcarRechazado(
    pago: PagoParaConfirmar,
    orden: RespuestaOrdenMp,
  ): Promise<void> {
    // Una notificación vieja nunca revierte un pago ya acreditado.
    if (pago.estado === 'PAGADO') return;

    await this.prisma.pago.update({
      where: { idPago: pago.idPago },
      data: {
        estado: 'RECHAZADO',
        mpStatus: orden.status ?? null,
        mpStatusDetail: orden.status_detail ?? null,
      },
    });
  }

  private async marcarProcesada(
    idNotificacion: string,
    alerta?: string,
  ): Promise<void> {
    await this.prisma.notificacionMercadoPago.update({
      where: { id: idNotificacion },
      data: { procesadaEn: new Date(), error: alerta?.slice(0, 500) ?? null },
    });
  }

  private async marcarError(
    idNotificacion: string,
    mensaje: string,
    definitivo: boolean,
  ): Promise<void> {
    await this.prisma.notificacionMercadoPago.update({
      where: { id: idNotificacion },
      data: {
        error: mensaje.slice(0, 500),
        ...(definitivo ? { procesadaEn: new Date() } : {}),
      },
    });
  }

  private describir(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
