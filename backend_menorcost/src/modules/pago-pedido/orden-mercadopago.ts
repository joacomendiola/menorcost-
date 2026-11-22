import { aMonto } from '../../common/utils/montos.util.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { CuerpoOrdenMp } from './cliente-mercadopago.js';
import type { UrlsRetornoPago } from './configuracion-pago-pedido.js';

export interface ItemOrdenMp {
  titulo: string;
  cantidad: number;
  precioUnitario: Prisma.Decimal;
}

export interface DatosOrdenMp {
  idPedido: string;
  nroPedido: string;
  nombreComercio: string;
  emailComprador: string;
  total: Prisma.Decimal;
  /** Comisión de Menorcost: es el `marketplace_fee`, no se le resta la de MP. */
  tarifaServicio: Prisma.Decimal;
  items: readonly ItemOrdenMp[];
  urlsRetorno: UrlsRetornoPago;
  urlWebhook: string;
  minutosExpiracion: number;
}

/**
 * Body de `POST /v1/orders` para Checkout Pro (Orders API).
 *
 * Decisiones tomadas de la documentación oficial (checkout-pro-orders):
 * - `type: 'online'` y `processing_mode: 'manual'` son los únicos valores
 *   posibles para Checkout Pro.
 * - `total_amount` tiene que ser igual a la suma de `unit_price × quantity`;
 *   nuestro `total` ya es esa suma porque el gross-up está en el precio público.
 * - `marketplace_fee` es lo que se acredita en la cuenta del marketplace: la
 *   tarifa de servicio de Menorcost, sin descontar la comisión de MP.
 * - `expiration_time` es una duración ISO 8601; la reserva dura lo mismo que
 *   la ventana de pago del pedido (60 minutos por defecto).
 * - `external_reference` es el id del pedido: con eso el webhook lo encuentra.
 *
 * Función pura: no llama a Mercado Pago ni a la base, así se testea directo.
 */
export function construirOrdenMercadoPago(datos: DatosOrdenMp): CuerpoOrdenMp {
  return {
    type: 'online',
    processing_mode: 'manual',
    external_reference: datos.idPedido,
    description: `Pedido ${datos.nroPedido} en ${datos.nombreComercio}`.slice(
      0,
      250,
    ),
    total_amount: aMonto(datos.total),
    marketplace_fee: aMonto(datos.tarifaServicio),
    currency: 'ARS',
    expiration_time: `PT${datos.minutosExpiracion}M`,
    payer: { email: datos.emailComprador },
    items: datos.items.map((item) => ({
      title: item.titulo,
      quantity: item.cantidad,
      unit_price: aMonto(item.precioUnitario),
    })),
    config: {
      online: {
        success_url: datos.urlsRetorno.exito,
        failure_url: datos.urlsRetorno.fallo,
        pending_url: datos.urlsRetorno.pendiente,
        auto_return: 'approved',
        callback_url: datos.urlWebhook,
      },
    },
  };
}

/**
 * URL de pago de una order ya creada.
 *
 * Sirve para el reintento y para el polling sin volver a llamar a la API:
 * Mercado Pago documenta `checkout_url` como
 * `https://www.mercadopago.com.ar/checkout/v1/redirect?order_id=<id>` (el
 * dominio depende del país del vendedor; el proyecto opera en Argentina).
 */
export function urlCheckoutDeOrden(mpOrderId: string): string {
  return `https://www.mercadopago.com.ar/checkout/v1/redirect?order_id=${encodeURIComponent(mpOrderId)}`;
}
