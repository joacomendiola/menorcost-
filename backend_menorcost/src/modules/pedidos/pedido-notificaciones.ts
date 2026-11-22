import { Logger } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service.js';

const logger = new Logger('NotificacionesPedido');

export type TipoNotificacionPedido =
  | 'PEDIDO_PAGADO'
  | 'PEDIDO_ENTREGADO'
  | 'PEDIDO_CANCELADO'
  | 'PEDIDO_CANCELADO_POR_FALTA_RETIRO';

/**
 * Crea una notificación in-app para el cliente. Nunca lanza: si falla, se
 * registra el warning y la transición de estado del pedido sigue siendo válida.
 *
 * Se llama SIEMPRE después del commit, nunca dentro de la transacción.
 */
export async function notificarPedido(
  prisma: PrismaService,
  datos: {
    usuarioId: string;
    tipo: TipoNotificacionPedido;
    titulo: string;
    mensaje: string;
  },
): Promise<void> {
  try {
    await prisma.notificacion.create({
      data: {
        usuarioId: datos.usuarioId,
        tipo: datos.tipo,
        titulo: datos.titulo,
        mensaje: datos.mensaje,
      },
    });
  } catch (error) {
    logger.warn(
      `No se pudo crear la notificación ${datos.tipo} para ${datos.usuarioId}: ${String(error)}`,
    );
  }
}
