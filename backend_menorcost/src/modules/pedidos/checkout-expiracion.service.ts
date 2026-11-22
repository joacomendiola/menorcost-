import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ConfiguracionPagoPedido } from '../pago-pedido/configuracion-pago-pedido.js';
import { liberarStockDePedido } from '../pago-pedido/reserva-stock.js';

/** Cantidad máxima de pedidos que se procesan por corrida. */
const LOTE = 50;

/**
 * Reaper de pedidos impagos (CU-3.03).
 *
 * Un pedido `PENDIENTE_PAGO` retiene stock. Cuando vence la ventana de pago
 * (60 minutos por defecto) más la gracia (5 minutos, para absorber el desfasaje
 * con el reloj de Mercado Pago y los webhooks en vuelo), se cancela y el stock
 * vuelve a la oferta.
 *
 * Es idempotente: `liberarStockDePedido` solo actúa si el pedido sigue
 * `PENDIENTE_PAGO` y todavía no se liberó, así una corrida repetida, un
 * solapamiento con el comerciante o un pago confirmado en el medio no duplican
 * stock ni pisan estados.
 */
@Injectable()
export class CheckoutExpiracionService {
  private readonly logger = new Logger(CheckoutExpiracionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfiguracionPagoPedido,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async cancelarPedidosVencidos(): Promise<void> {
    const limite = new Date(
      Date.now() - this.config.minutosGracia() * 60_000,
    );

    const vencidos = await this.prisma.pedido.findMany({
      where: {
        estado: 'PENDIENTE_PAGO',
        stockLiberadoEn: null,
        fechaExpiracionPago: { lt: limite },
      },
      select: { id_pedido: true },
      orderBy: { fechaExpiracionPago: 'asc' },
      take: LOTE,
    });

    let cancelados = 0;

    for (const pedido of vencidos) {
      try {
        const liberado = await this.prisma.$transaction((tx) =>
          liberarStockDePedido(tx, pedido.id_pedido, 'EXPIRADO'),
        );

        if (liberado) cancelados += 1;
      } catch (error) {
        // Un pedido problemático no frena el resto del lote.
        this.logger.error(
          `No se pudo cancelar el pedido vencido ${pedido.id_pedido}.`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    if (cancelados > 0) {
      this.logger.log(
        `Expiración de pagos: ${cancelados} pedido(s) cancelado(s) y stock liberado.`,
      );
    }
  }
}
