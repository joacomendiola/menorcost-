import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { fechaISOaDate } from '../../common/utils/fechas-ar.util.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CanastasService } from '../canastas/canastas.service.js';
import {
  generarCodigoAlfanumerico,
  generarCodigoQR,
  generarNroPedido,
} from './codigos-pedido.js';
import type { CrearPedidoDto } from './dto/crear-pedido.dto.js';
import { FranjasService } from './franjas.service.js';
import { aDecimal, aMonto, redondearArriba2 } from './montos.js';
import {
  PASARELA_PAGO,
  type PasarelaPago,
} from './pago-simulado.service.js';
import type {
  CheckoutConfirmado,
  CheckoutResumen,
  EstadoPedidoEnCheckout,
} from './pedidos.types.js';

type DetalleCheckout = Awaited<
  ReturnType<CanastasService['obtenerCanastaParaCheckout']>
>;

const MENSAJE_STOCK =
  'Uno o más productos seleccionados se han agotado o no cuentan con el stock suficiente.';

interface LineaCalculada {
  productoId: string;
  nroLinea: number;
  cantidad: number;
  precioUnitario: Prisma.Decimal;
  precioBaseNetoAplicado: Prisma.Decimal;
  comisionMenorcostMonto: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  nombreHistorico: string;
  fechaVencimientoHistorica: Date;
  baseNetoTotal: Prisma.Decimal;
}

interface Creado {
  id_pedido: string;
  codigoAlfanumerico: string;
  total: Prisma.Decimal;
}

interface CalculoPedido {
  lineas: LineaCalculada[];
  subtotal: Prisma.Decimal;
  tarifaServicio: Prisma.Decimal;
  splitComercio: Prisma.Decimal;
  total: Prisma.Decimal;
  tasaMenorcost: Prisma.Decimal;
  tasaMp: Prisma.Decimal;
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly canastas: CanastasService,
    private readonly franjas: FranjasService,
    @Inject(PASARELA_PAGO) private readonly pasarela: PasarelaPago,
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

    const { total } = this.calcular(detalle);

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
      subtotal: aMonto(total),
      total: aMonto(total),
      franjas,
    };
  }

  async pagar(
    usuarioId: string,
    dto: CrearPedidoDto,
  ): Promise<CheckoutConfirmado> {
    // 1) Lectura y cálculo: se validan franja y stock antes de tocar la base.
    const franja = await this.franjas.validarParaCheckout(
      dto.comercioId,
      dto.franjaHorarioId,
    );
    const resultado = dto.resultadoPagoSimulado ?? 'APROBADO';
    const claveIdempotencia = dto.idempotencyKey?.trim() || null;

    if (claveIdempotencia) {
      const previo = await this.buscarPorIdempotencia(claveIdempotencia);
      if (previo) {
        if (
          previo.usuarioId !== usuarioId ||
          previo.comercioId !== dto.comercioId
        ) {
          throw new ConflictException(
            'La clave de idempotencia ya fue utilizada por otro checkout.',
          );
        }
        return this.aConfirmado(previo);
      }
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

    const detalle = await this.canastas.obtenerCanastaParaCheckout(
      canasta.idCanasta,
    );
    const calculo = this.calcular(detalle);

    // 2) Cobro: SIEMPRE fuera de la transacción. Si falla, no se persiste
    //    nada y la canasta del cliente queda intacta para reintentar.
    const cobro = await this.pasarela.cobrar({
      total: calculo.total,
      tasaMp: calculo.tasaMp,
      resultado,
    });

    if (!cobro.aprobado) {
      throw new HttpException(
        {
          estado: 'RECHAZADO',
          message:
            'Pago rechazado: no se descontó stock y tu canasta sigue disponible.',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    // 3) Persistencia: una única transacción corta, sin llamadas externas.
    let creado: { pedido: Creado; clave: string | null };
    try {
      creado = await this.conReintentoDeCodigos(() =>
        this.prisma.$transaction(async (tx) => {
          const canastaTx = await tx.canasta.findUnique({
            where: {
              usuarioId_comercioId: {
                usuarioId,
                comercioId: dto.comercioId,
              },
            },
            select: { idCanasta: true },
          });

          if (!canastaTx) {
            throw new ConflictException(
              'Este checkout ya fue procesado. Revisá "Mis pedidos".',
            );
          }

          const detalleTx = await this.canastas.obtenerCanastaParaCheckout(
            canastaTx.idCanasta,
            tx,
          );

          await this.descontarStock(tx, detalleTx);

          const pedido = await tx.pedido.create({
            data: {
              nroPedido: generarNroPedido(),
              codigoQR: generarCodigoQR(),
              codigoAlfanumerico: generarCodigoAlfanumerico(),
              idempotencyKey: claveIdempotencia,
              usuarioId,
              comercioId: dto.comercioId,
              estado: 'PENDIENTE_DE_RETIRO',
              franjaHorarioId: franja.id,
              subtotal: calculo.subtotal,
              tarifa_servicio: calculo.tarifaServicio,
              comisionMenorcostTasa: calculo.tasaMenorcost,
              tasaMpEstimada: calculo.tasaMp,
              total: calculo.total,
              formaPago: 'SIMULADO',
              items: {
                create: calculo.lineas.map((linea) => ({
                  productoId: linea.productoId,
                  nroLinea: linea.nroLinea,
                  cantidad: linea.cantidad,
                  precio_unitario: linea.precioUnitario,
                  precioBaseNetoAplicado: linea.precioBaseNetoAplicado,
                  comisionMenorcostMonto: linea.comisionMenorcostMonto,
                  subtotal: linea.subtotal,
                  nombreHistorico: linea.nombreHistorico,
                  fechaVencimientoHistorica: linea.fechaVencimientoHistorica,
                })),
              },
              pagos: {
                create: {
                  montoTransaccion: calculo.total,
                  comisionMp: cobro.comisionMp,
                  nroComprobante: cobro.nroComprobante,
                  mpPaymentId: cobro.mpPaymentId,
                  paymentDate: new Date(),
                  estado: 'PAGADO',
                  moneda: 'ARS',
                  splits: {
                    create: [
                      {
                        recipientType: 'COMERCIO',
                        destinatarioId: dto.comercioId,
                        monto: calculo.splitComercio,
                      },
                      {
                        recipientType: 'MARKETPLACE',
                        destinatarioId: null,
                        monto: calculo.total
                          .minus(cobro.comisionMp)
                          .minus(calculo.splitComercio),
                      },
                    ],
                  },
                },
              },
            },
            select: {
              id_pedido: true,
              codigoAlfanumerico: true,
              total: true,
            },
          });

          await tx.canasta.delete({
            where: { idCanasta: canastaTx.idCanasta },
          });

          return { pedido, clave: claveIdempotencia };
        }),
      );
    } catch (error) {
      // Doble click con la misma clave: otro request ya creó el pedido.
      if (claveIdempotencia && esConflictoDeIdempotencia(error)) {
        const previo = await this.buscarPorIdempotencia(claveIdempotencia);
        if (previo) {
          // Nunca se devuelve el pedido de otro usuario ni de otro comercio.
          if (
            previo.usuarioId !== usuarioId ||
            previo.comercioId !== dto.comercioId
          ) {
            throw new ConflictException(
              'La clave de idempotencia ya fue utilizada por otro checkout.',
            );
          }
          return this.aConfirmado(previo);
        }
      }
      throw error;
    }

    return {
      idPedido: creado.pedido.id_pedido,
      codigoAlfanumerico: creado.pedido.codigoAlfanumerico,
      estado: 'PENDIENTE_DE_RETIRO',
      total: aMonto(creado.pedido.total),
    };
  }

  private async buscarPorIdempotencia(clave: string) {
    return this.prisma.pedido.findUnique({
      where: { idempotencyKey: clave },
      select: {
        id_pedido: true,
        usuarioId: true,
        comercioId: true,
        codigoAlfanumerico: true,
        total: true,
        estado: true,
      },
    });
  }

  private aConfirmado(pedido: {
    id_pedido: string;
    codigoAlfanumerico: string;
    total: Prisma.Decimal;
    estado: EstadoPedidoEnCheckout;
  }): CheckoutConfirmado {
    return {
      idPedido: pedido.id_pedido,
      codigoAlfanumerico: pedido.codigoAlfanumerico,
      estado: pedido.estado,
      total: aMonto(pedido.total),
    };
  }

  /**
   * Descuento condicional: el `where` con `stock: { gte: cantidad }` evita que
   * dos compras simultáneas vendan la misma unidad. Si el `count` no es 1, la
   * transacción entera revierte.
   */
  private async descontarStock(
    tx: Prisma.TransactionClient,
    detalle: DetalleCheckout,
  ): Promise<void> {
    for (const item of detalle.items) {
      const { count } = await tx.producto.updateMany({
        where: {
          idProducto: item.productoId,
          estado: 'ACTIVO',
          stock: { gte: item.cantidad },
        },
        data: { stock: { decrement: item.cantidad } },
      });

      if (count !== 1) {
        throw new ConflictException(MENSAJE_STOCK);
      }
    }
  }

  private calcular(detalle: DetalleCheckout): CalculoPedido {
    const lineas: LineaCalculada[] = detalle.items.map((item, indice) => {
      const precioUnitario = aDecimal(item.precioUnitario);
      const baseNeto = aDecimal(item.producto.precioBaseNeto);
      const tasaMenorcost = aDecimal(
        item.producto.comisionMenorcostTasaAplicada,
      );
      const comisionUnitaria = redondearArriba2(
        baseNeto.mul(tasaMenorcost),
      );

      return {
        productoId: item.productoId,
        nroLinea: indice + 1,
        cantidad: item.cantidad,
        precioUnitario,
        precioBaseNetoAplicado: baseNeto,
        comisionMenorcostMonto: comisionUnitaria.mul(item.cantidad),
        subtotal: precioUnitario.mul(item.cantidad),
        nombreHistorico: item.producto.titulo,
        fechaVencimientoHistorica: fechaISOaDate(
          item.producto.fechaVencimiento,
        ),
        baseNetoTotal: baseNeto.mul(item.cantidad),
      };
    });

    const cero = new Prisma.Decimal(0);
    const subtotal = lineas.reduce((total, linea) => total.plus(linea.subtotal), cero);
    const tarifaServicio = lineas.reduce(
      (total, linea) => total.plus(linea.comisionMenorcostMonto),
      cero,
    );
    const splitComercio = lineas.reduce(
      (total, linea) => total.plus(linea.baseNetoTotal),
      cero,
    );

    return {
      lineas,
      subtotal,
      tarifaServicio,
      splitComercio,
      total: subtotal,
      tasaMenorcost: aDecimal(
        detalle.items[0].producto.comisionMenorcostTasaAplicada,
      ),
      tasaMp: aDecimal(detalle.items[0].producto.tasaMpEstimadaAplicada),
    };
  }

  /**
   * Los códigos del pedido son únicos: ante una colisión (probabilidad muy
   * baja) se reintenta la transacción completa en lugar de fallar.
   *
   * Solo se reintenta por los códigos del pedido. Cualquier otro `P2002`
   * (por ejemplo `idempotency_key`) se propaga.
   */
  private async conReintentoDeCodigos<T>(
    ejecutar: () => Promise<T>,
  ): Promise<T> {
    const INTENTOS = 3;

    for (let intento = 0; intento < INTENTOS; intento += 1) {
      try {
        return await ejecutar();
      } catch (error) {
        const colisionDeCodigo =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          esColisionDeCodigoDePedido(error);

        if (!colisionDeCodigo || intento === INTENTOS - 1) {
          throw error;
        }
      }
    }

    throw new Error('No se pudo generar un código único para el pedido.');
  }
}

function destinoDelError(error: Prisma.PrismaClientKnownRequestError): string {
  const target = error.meta?.target;

  if (Array.isArray(target)) return target.join(',');
  if (typeof target === 'string') return target;

  return '';
}

/** Colisión de `codigoQR`, `codigoAlfanumerico` o `nroPedido`. */
function esColisionDeCodigoDePedido(
  error: Prisma.PrismaClientKnownRequestError,
): boolean {
  const destino = destinoDelError(error).toLowerCase();

  return (
    destino.includes('codigo_qr') ||
    destino.includes('codigo_alfanumerico') ||
    destino.includes('nro_pedido') ||
    destino.includes('codigoqr') ||
    destino.includes('codigoalfanumerico') ||
    destino.includes('nropedido')
  );
}

/** Colisión de la clave de idempotencia del checkout. */
function esConflictoDeIdempotencia(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    destinoDelError(error).toLowerCase().includes('idempotency')
  );
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
