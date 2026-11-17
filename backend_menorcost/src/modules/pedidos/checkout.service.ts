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
import type { CheckoutConfirmado, CheckoutResumen } from './pedidos.types.js';

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

    const { total, tarifaServicio } = this.calcular(detalle);

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
      tarifaServicio: aMonto(tarifaServicio),
      total: aMonto(total),
      franjas,
    };
  }

  async pagar(
    usuarioId: string,
    dto: CrearPedidoDto,
  ): Promise<CheckoutConfirmado> {
    // Se valida la franja antes de abrir la transacción: es una lectura idem-
    // potente y nos deja fallar rápido sin tomar locks.
    const franja = await this.franjas.validarParaCheckout(
      dto.comercioId,
      dto.franjaHorarioId,
    );
    const resultado = dto.resultadoPagoSimulado ?? 'APROBADO';

    const creado = await this.conReintentoDeCodigos(() =>
      this.prisma.$transaction(async (tx) => {
        const canasta = await tx.canasta.findUnique({
          where: {
            usuarioId_comercioId: {
              usuarioId,
              comercioId: dto.comercioId,
            },
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
          tx,
        );
        const calculo = this.calcular(detalle);

        const cobro = await this.pasarela.cobrar({
          total: calculo.total,
          tasaMp: calculo.tasaMp,
          resultado,
        });

        if (cobro.aprobado) {
          await this.descontarStock(tx, detalle);
        }

        const pedido = await tx.pedido.create({
          data: {
            nroPedido: generarNroPedido(),
            codigoQR: generarCodigoQR(),
            codigoAlfanumerico: generarCodigoAlfanumerico(),
            usuarioId,
            comercioId: dto.comercioId,
            estado: cobro.aprobado ? 'PENDIENTE_DE_RETIRO' : 'PENDIENTE_PAGO',
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
                paymentDate: cobro.aprobado ? new Date() : null,
                estado: cobro.aprobado ? 'PAGADO' : 'RECHAZADO',
                moneda: 'ARS',
                splits: cobro.aprobado
                  ? {
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
                    }
                  : undefined,
              },
            },
          },
          select: {
            id_pedido: true,
            codigoAlfanumerico: true,
            total: true,
          },
        });

        if (cobro.aprobado) {
          await tx.canasta.delete({
            where: { idCanasta: canasta.idCanasta },
          });
        }

        return { pedido, aprobado: cobro.aprobado };
      }),
    );

    if (!creado.aprobado) {
      throw new HttpException(
        {
          idPedido: creado.pedido.id_pedido,
          estado: 'RECHAZADO',
          mensaje:
            'Pago rechazado: no se descontó stock y la canasta sigue disponible.',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return {
      idPedido: creado.pedido.id_pedido,
      codigoAlfanumerico: creado.pedido.codigoAlfanumerico,
      estado: 'PENDIENTE_DE_RETIRO',
      total: aMonto(creado.pedido.total),
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
          error.code === 'P2002';

        if (!colisionDeCodigo || intento === INTENTOS - 1) {
          throw error;
        }
      }
    }

    throw new Error('No se pudo generar un código único para el pedido.');
  }
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
