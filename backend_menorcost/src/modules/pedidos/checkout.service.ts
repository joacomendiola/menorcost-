import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { aMonto } from '../../common/utils/montos.util.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CanastasService } from '../canastas/canastas.service.js';
import { calcularPedido } from '../pago-pedido/calculo-pedido.js';
import { ClienteMercadoPago } from '../pago-pedido/cliente-mercadopago.js';
import { ConfiguracionPagoPedido } from '../pago-pedido/configuracion-pago-pedido.js';
import { CredencialMercadoPagoService } from '../pago-pedido/credencial-mercadopago.service.js';
import { ErrorPagoMercadoPago } from '../pago-pedido/error-pago-mercadopago.js';
import {
  construirOrdenMercadoPago,
  urlCheckoutDeOrden,
  type ItemOrdenMp,
} from '../pago-pedido/orden-mercadopago.js';
import {
  liberarStockDePedido,
  reservarStock,
} from '../pago-pedido/reserva-stock.js';
import {
  generarCodigoAlfanumerico,
  generarCodigoQR,
  generarNroPedido,
} from './codigos-pedido.js';
import type { CrearPedidoDto } from './dto/crear-pedido.dto.js';
import { FranjasService } from './franjas.service.js';
import type {
  CheckoutConfirmado,
  CheckoutResumen,
  EstadoPedidoCheckout,
} from './pedidos.types.js';

interface IntentoDeCobro {
  idPedido: string;
  nroPedido: string;
  idPago: string;
  comercioId: string;
  accessToken: string;
  nombreComercio: string;
  emailComprador: string;
  total: Prisma.Decimal;
  tarifaServicio: Prisma.Decimal;
  items: ItemOrdenMp[];
}

/**
 * Checkout de CU-3.03: reserva de stock, pedido pendiente de pago y orden de
 * Mercado Pago (Checkout Pro vía Orders API con `marketplace_fee`).
 *
 * La llamada a Mercado Pago queda FUERA de la transacción: no se retiene una
 * conexión de PostgreSQL mientras responde un tercero. Si la orden no se puede
 * crear, el pedido se cancela y el stock vuelve en el acto.
 */
@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly canastas: CanastasService,
    private readonly franjas: FranjasService,
    private readonly credenciales: CredencialMercadoPagoService,
    private readonly mercadoPago: ClienteMercadoPago,
    private readonly config: ConfiguracionPagoPedido,
  ) {}

  async obtenerResumen(
    usuarioId: string,
    comercioId: string,
  ): Promise<CheckoutResumen> {
    const canasta = await this.prisma.canasta.findUnique({
      where: { usuarioId_comercioId: { usuarioId, comercioId } },
      select: { idCanasta: true },
    });

    if (!canasta) {
      throw new NotFoundException(
        'No tenés una canasta activa en este comercio.',
      );
    }

    const [detalle, franjas, comercio] = await Promise.all([
      this.canastas.obtenerCanastaParaCheckout(canasta.idCanasta),
      this.franjas.listarParaCheckout(comercioId),
      this.prisma.comercio.findUnique({
        where: { idComercio: comercioId },
        select: {
          nombreFantasia: true,
          calle: true,
          numero: true,
          piso: true,
          localidad: true,
          provincia: true,
          abierto: true,
        },
      }),
    ]);

    if (!comercio) {
      throw new NotFoundException('El comercio no existe.');
    }

    const calculo = calcularPedido(detalle);

    return {
      comercio: {
        idComercio: comercioId,
        nombreFantasia: comercio.nombreFantasia,
        direccion: formatearDireccion(comercio),
        abierto: comercio.abierto,
      },
      items: detalle.items.map((item) => ({
        productoId: item.productoId,
        titulo: item.producto.titulo,
        imagen: item.producto.imagen,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        subtotal: item.subtotal,
      })),
      subtotal: aMonto(calculo.subtotal),
      total: aMonto(calculo.total),
      franjas,
    };
  }

  async pagar(
    usuarioId: string,
    dto: CrearPedidoDto,
  ): Promise<CheckoutConfirmado> {
    // Idempotencia lógica: el mismo click rebotado no crea otro pedido.
    if (dto.idempotencyKey) {
      const existente = await this.pedidoPorIdempotencia(
        usuarioId,
        dto.idempotencyKey,
      );
      if (existente) return existente;
    }

    const canasta = await this.prisma.canasta.findUnique({
      where: {
        usuarioId_comercioId: { usuarioId, comercioId: dto.comercioId },
      },
      select: { idCanasta: true },
    });

    if (!canasta) {
      throw new NotFoundException(
        'No tenés una canasta activa en este comercio.',
      );
    }

    const franja = await this.franjas.validarParaCheckout(
      dto.comercioId,
      dto.franjaHorarioId,
    );

    const [usuario, credencial] = await Promise.all([
      this.prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { email: true },
      }),
      this.credenciales
        .obtenerCredencialActiva(dto.comercioId)
        .catch((error: unknown) => {
          throw this.aExcepcionHttp(error);
        }),
    ]);

    let creado;
    try {
      creado = await this.prisma.$transaction(async (tx) => {
        // La validación de comercio habilitado, MP vinculado, items activos y
        // stock vive en `obtenerCanastaParaCheckout` (D3) y corre acá adentro.
        const detalle = await this.canastas.obtenerCanastaParaCheckout(
          canasta.idCanasta,
          tx,
        );
        const calculo = calcularPedido(detalle);

        await reservarStock(
          tx,
          detalle.items.map((item) => ({
            productoId: item.productoId,
            cantidad: item.cantidad,
          })),
        );

        const ahora = new Date();
        const pedido = await tx.pedido.create({
          data: {
            nroPedido: generarNroPedido(ahora),
            idempotencyKey: dto.idempotencyKey ?? null,
            usuarioId,
            comercioId: dto.comercioId,
            estado: 'PENDIENTE_PAGO',
            codigoQR: generarCodigoQR(),
            codigoAlfanumerico: generarCodigoAlfanumerico(),
            fechaExpiracionPago: new Date(
              ahora.getTime() + this.config.minutosExpiracion() * 60_000,
            ),
            franjaHorarioId: franja.id,
            subtotal: calculo.subtotal,
            tarifa_servicio: calculo.tarifaServicio,
            comisionMenorcostTasa: calculo.tasaMenorcost,
            tasaMpEstimada: calculo.tasaMp,
            total: calculo.total,
            items: {
              create: calculo.lineas.map((linea) => ({
                nroLinea: linea.nroLinea,
                productoId: linea.productoId,
                cantidad: linea.cantidad,
                precio_unitario: linea.precioUnitario,
                precioBaseNetoAplicado: linea.precioBaseNetoAplicado,
                comisionMenorcostMonto: linea.comisionMenorcostMonto,
                subtotal: linea.subtotal,
                nombreHistorico: linea.nombreHistorico,
                fechaVencimientoHistorica: linea.fechaVencimientoHistorica,
              })),
            },
          },
          select: { id_pedido: true, nroPedido: true, estado: true },
        });

        const pago = await tx.pago.create({
          data: {
            pedidoId: pedido.id_pedido,
            credencialId: credencial.idCredencial,
            montoTransaccion: calculo.total,
            estado: 'PENDIENTE',
          },
          select: { idPago: true },
        });

        // La canasta se borra recién con el pedido y la reserva confirmados.
        await tx.canasta.delete({ where: { idCanasta: canasta.idCanasta } });

        const intento: IntentoDeCobro = {
          idPedido: pedido.id_pedido,
          nroPedido: pedido.nroPedido,
          idPago: pago.idPago,
          comercioId: dto.comercioId,
          accessToken: credencial.accessToken,
          nombreComercio: detalle.comercio.nombreFantasia,
          emailComprador: usuario?.email ?? '',
          total: calculo.total,
          tarifaServicio: calculo.tarifaServicio,
          items: calculo.lineas.map((linea) => ({
            titulo: linea.nombreHistorico,
            cantidad: linea.cantidad,
            precioUnitario: linea.precioUnitario,
          })),
        };

        return { intento, estado: pedido.estado };
      });
    } catch (error) {
      // Doble click simultáneo: la unique de `idempotency_key` decide quién
      // ganó y el perdedor devuelve ese mismo pedido.
      if (esClaveDuplicada(error) && dto.idempotencyKey) {
        const existente = await this.pedidoPorIdempotencia(
          usuarioId,
          dto.idempotencyKey,
        );
        if (existente) return existente;
      }

      throw error;
    }

    try {
      const urlRedireccion = await this.crearOrdenEnMercadoPago(
        creado.intento,
      );

      return {
        idPedido: creado.intento.idPedido,
        estado: creado.estado,
        urlRedireccion,
      };
    } catch (error) {
      await this.cancelarSinCobro(creado.intento);
      throw this.aExcepcionHttp(error);
    }
  }

  /**
   * Reintento de pago: reutiliza la order vigente si todavía sirve y, si el
   * intento anterior quedó rechazado, abre un `Pago` nuevo (la order anterior
   * no se toca: queda como auditoría).
   */
  async reintentar(
    usuarioId: string,
    idPedido: string,
  ): Promise<CheckoutConfirmado> {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id_pedido: idPedido },
      select: {
        id_pedido: true,
        nroPedido: true,
        usuarioId: true,
        comercioId: true,
        estado: true,
        total: true,
        tarifa_servicio: true,
        fechaExpiracionPago: true,
        comercio: { select: { nombreFantasia: true } },
        usuario: { select: { email: true } },
        items: {
          select: {
            nombreHistorico: true,
            cantidad: true,
            precio_unitario: true,
          },
        },
        pagos: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { idPago: true, estado: true, mpOrderId: true },
        },
      },
    });

    if (!pedido || pedido.usuarioId !== usuarioId) {
      throw new NotFoundException('Pedido no encontrado.');
    }

    if (pedido.estado !== 'PENDIENTE_PAGO') {
      throw new ConflictException(
        'Este pedido ya no está pendiente de pago.',
      );
    }

    const ultimo = pedido.pagos[0];
    if (ultimo?.estado === 'PENDIENTE' && ultimo.mpOrderId) {
      return {
        idPedido,
        estado: pedido.estado,
        urlRedireccion: urlCheckoutDeOrden(ultimo.mpOrderId),
      };
    }

    if (
      pedido.fechaExpiracionPago &&
      pedido.fechaExpiracionPago.getTime() < Date.now()
    ) {
      await this.prisma.$transaction(async (tx) => {
        await liberarStockDePedido(tx, idPedido, 'EXPIRADO');
      });

      throw new ConflictException(
        'El tiempo para pagar este pedido venció y el stock volvió a estar disponible.',
      );
    }

    const credencial = await this.credenciales
      .obtenerCredencialActiva(pedido.comercioId)
      .catch((error: unknown) => {
        throw this.aExcepcionHttp(error);
      });

    const pago = await this.prisma.pago.create({
      data: {
        pedidoId: idPedido,
        credencialId: credencial.idCredencial,
        montoTransaccion: pedido.total,
        estado: 'PENDIENTE',
      },
      select: { idPago: true },
    });

    try {
      const urlRedireccion = await this.crearOrdenEnMercadoPago({
        idPedido,
        nroPedido: pedido.nroPedido,
        idPago: pago.idPago,
        comercioId: pedido.comercioId,
        accessToken: credencial.accessToken,
        nombreComercio: pedido.comercio?.nombreFantasia ?? 'el comercio',
        emailComprador: pedido.usuario?.email ?? '',
        total: pedido.total,
        tarifaServicio: pedido.tarifa_servicio,
        items: pedido.items.map((item) => ({
          titulo: item.nombreHistorico,
          cantidad: item.cantidad,
          precioUnitario: item.precio_unitario,
        })),
      });

      return { idPedido, estado: pedido.estado, urlRedireccion };
    } catch (error) {
      // Acá NO se cancela el pedido: el stock sigue reservado hasta el
      // vencimiento para que el cliente pueda volver a intentarlo.
      await this.prisma.pago.update({
        where: { idPago: pago.idPago },
        data: { estado: 'RECHAZADO' },
      });

      throw this.aExcepcionHttp(error);
    }
  }

  /** Estado real del pedido para la pantalla de resultado (polling). */
  async obtenerEstado(
    usuarioId: string,
    idPedido: string,
  ): Promise<EstadoPedidoCheckout> {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id_pedido: idPedido },
      select: {
        id_pedido: true,
        usuarioId: true,
        estado: true,
        codigoAlfanumerico: true,
        pagos: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { estado: true, mpOrderId: true },
        },
      },
    });

    if (!pedido || pedido.usuarioId !== usuarioId) {
      throw new NotFoundException('Pedido no encontrado.');
    }

    const pago = pedido.pagos[0];
    const pendienteDeCobro =
      pedido.estado === 'PENDIENTE_PAGO' &&
      pago?.estado === 'PENDIENTE' &&
      pago.mpOrderId;

    return {
      idPedido,
      estado: pedido.estado,
      pagoEstado: pago?.estado ?? null,
      codigoAlfanumerico: pedido.codigoAlfanumerico,
      urlRedireccion: pendienteDeCobro
        ? urlCheckoutDeOrden(pago.mpOrderId as string)
        : null,
    };
  }

  /** Crea la order afuera de toda transacción y guarda su id en el intento. */
  private async crearOrdenEnMercadoPago(
    intento: IntentoDeCobro,
  ): Promise<string> {
    const orden = await this.mercadoPago.crearOrden(
      intento.accessToken,
      construirOrdenMercadoPago({
        idPedido: intento.idPedido,
        nroPedido: intento.nroPedido,
        nombreComercio: intento.nombreComercio,
        emailComprador: intento.emailComprador,
        total: intento.total,
        tarifaServicio: intento.tarifaServicio,
        items: intento.items,
        urlsRetorno: this.config.urlsRetorno(intento.idPedido),
        urlWebhook: this.config.urlWebhook(),
        minutosExpiracion: this.config.minutosExpiracion(),
      }),
      // Un UUID por intento de pago: evita orders duplicadas si se reintenta.
      intento.idPago,
      intento.comercioId,
    );

    if (!orden.id) {
      throw new ErrorPagoMercadoPago(
        'respuesta_invalida',
        'Mercado Pago no devolvió la orden de pago.',
      );
    }

    await this.prisma.pago.update({
      where: { idPago: intento.idPago },
      data: {
        mpOrderId: orden.id,
        mpStatus: orden.status ?? null,
        mpStatusDetail: orden.status_detail ?? null,
      },
    });

    return orden.checkout_url ?? urlCheckoutDeOrden(orden.id);
  }

  /** Fallback del checkout: sin order no hay cobro, entonces no hay reserva. */
  private async cancelarSinCobro(intento: IntentoDeCobro): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await liberarStockDePedido(tx, intento.idPedido, 'PAGO_NO_INICIADO');
      await tx.pago.update({
        where: { idPago: intento.idPago },
        data: { estado: 'RECHAZADO' },
      });
    });
  }

  private async pedidoPorIdempotencia(
    usuarioId: string,
    clave: string,
  ): Promise<CheckoutConfirmado | null> {
    const pedido = await this.prisma.pedido.findFirst({
      where: { idempotencyKey: clave, usuarioId },
      select: { id_pedido: true, estado: true },
    });

    if (!pedido) return null;

    const pago = await this.prisma.pago.findFirst({
      where: { pedidoId: pedido.id_pedido, estado: 'PENDIENTE' },
      orderBy: { createdAt: 'desc' },
      select: { mpOrderId: true },
    });

    return {
      idPedido: pedido.id_pedido,
      estado: pedido.estado,
      urlRedireccion: pago?.mpOrderId
        ? urlCheckoutDeOrden(pago.mpOrderId)
        : null,
    };
  }

  private aExcepcionHttp(error: unknown): Error {
    if (error instanceof ErrorPagoMercadoPago) {
      if (error.codigo === 'credencial_invalida') {
        return new BadRequestException(error.message);
      }

      if (error.codigo === 'mp_no_disponible') {
        return new ServiceUnavailableException(error.message);
      }

      return new BadGatewayException(error.message);
    }

    return error instanceof Error ? error : new Error(String(error));
  }
}

/** `P2002` sobre la clave de idempotencia del pedido. */
function esClaveDuplicada(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== 'P2002') return false;

  const objetivo = error.meta?.target;
  const texto = Array.isArray(objetivo) ? objetivo.join(' ') : String(objetivo);

  return texto.includes('idempotency_key');
}

function formatearDireccion(comercio: {
  calle: string;
  numero: string;
  piso: string | null;
  localidad: string;
  provincia: string;
}): string {
  const linea = [comercio.calle, comercio.numero].filter(Boolean).join(' ');
  const partes = [
    linea,
    comercio.piso ? `Piso ${comercio.piso}` : null,
    comercio.localidad,
    comercio.provincia,
  ].filter(Boolean);

  return partes.join(', ');
}
