import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { aMonto } from '../../common/utils/montos.util.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { calcularPedido } from '../pago-pedido/calculo-pedido.js';
import { CanastasService } from '../canastas/canastas.service.js';
import type { CrearPedidoDto } from './dto/crear-pedido.dto.js';
import { FranjasService } from './franjas.service.js';
import type { CheckoutConfirmado, CheckoutResumen } from './pedidos.types.js';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly canastas: CanastasService,
    private readonly franjas: FranjasService,
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

  /**
   * El checkout todavía no cobra: la única forma de pago del proyecto es
   * Mercado Pago (Checkout Pro con Split Payment) y esa integración es la
   * etapa siguiente. La canasta queda intacta para reintentar cuando esté
   * disponible.
   */
  async pagar(
    _usuarioId: string,
    _dto: CrearPedidoDto,
  ): Promise<CheckoutConfirmado> {
    throw new ServiceUnavailableException(
      'El pago con Mercado Pago todavía no está disponible. Tu canasta queda guardada para reintentar más tarde.',
    );
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
