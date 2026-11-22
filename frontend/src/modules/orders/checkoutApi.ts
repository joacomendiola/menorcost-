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

export interface CheckoutConfirmado {
  idPedido: string;
  codigoAlfanumerico: string;
  /** Puede no ser PENDIENTE_DE_RETIRO si el reintento devuelve un pedido previo. */
  estado: EstadoCheckoutConfirmado;
  total: string;
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
};
