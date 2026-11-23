import { api } from '../../api';

export interface CheckoutItem {
  productoId: string;
  titulo: string;
  imagen: string;
  cantidad: number;
  precioUnitario: string;
  subtotal: string;
}

export interface CheckoutFranja {
  id: string;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  fechaRetiro: string;
  etiqueta: string;
}

export interface CheckoutResumen {
  comercio: {
    idComercio: string;
    nombreFantasia: string;
    direccion: string;
    abierto: boolean;
  };
  items: CheckoutItem[];
  subtotal: string;
  total: string;
  franjas: CheckoutFranja[];
}

export type EstadoCheckoutConfirmado =
  | 'PENDIENTE_DE_RETIRO'
  | 'PENDIENTE_PAGO'
  | 'ENTREGADO'
  | 'CANCELADO'
  | 'CANCELADO_POR_FALTA_RETIRO';

/** Respuesta de `POST /checkout` y `POST /checkout/:idPedido/reintentar`. */
export interface CheckoutConfirmado {
  idPedido: string;
  /** Puede no ser PENDIENTE_DE_RETIRO si el reintento devuelve un pedido previo. */
  estado: EstadoCheckoutConfirmado;
  /** Checkout de Mercado Pago; `null` si no hay un cobro abierto. */
  urlRedireccion: string | null;
}

/** Respuesta de `GET /checkout/pedido/:idPedido/estado` (polling del pago). */
export interface EstadoPedidoCheckout {
  idPedido: string;
  estado: EstadoCheckoutConfirmado;
  pagoEstado: string | null;
  codigoAlfanumerico: string;
  /** Sigue disponible mientras el pedido espera el pago; si no, `null`. */
  urlRedireccion: string | null;
}

export interface CrearPedidoPayload {
  comercioId: string;
  franjaHorarioId: string;
  /** Clave estable por intento de checkout: evita pedidos duplicados. */
  idempotencyKey: string;
}

export const checkoutApi = {
  obtenerResumen: (token: string, comercioId: string) =>
    api<CheckoutResumen>(
      `/checkout/${encodeURIComponent(comercioId)}`,
      { token },
    ),

  pagar: (token: string, payload: CrearPedidoPayload) =>
    api<CheckoutConfirmado>('/checkout', {
      method: 'POST',
      body: payload,
      token,
    }),

  obtenerEstado: (token: string, idPedido: string) =>
    api<EstadoPedidoCheckout>(
      `/checkout/pedido/${encodeURIComponent(idPedido)}/estado`,
      { token },
    ),

  reintentar: (token: string, idPedido: string) =>
    api<CheckoutConfirmado>(
      `/checkout/${encodeURIComponent(idPedido)}/reintentar`,
      { method: 'POST', token },
    ),
};
