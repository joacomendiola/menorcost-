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
  /** Próxima fecha concreta de retiro habilitada para esta franja. */
  fechaRetiro: string;
  /** Texto listo para el selector: `Lun 17/11 · 10:00 a 11:00`. */
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

export type EstadoPedidoEnCheckout = EstadoPedidoVisible | 'PENDIENTE_PAGO';

export interface CheckoutConfirmado {
  idPedido: string;
  estado: EstadoPedidoEnCheckout;
  /** Checkout de Mercado Pago al que hay que redirigir al comprador. */
  urlRedireccion: string | null;
}

/** Respuesta de `GET /checkout/pedido/:idPedido/estado` (polling del pago). */
export interface EstadoPedidoCheckout {
  idPedido: string;
  estado: EstadoPedidoEnCheckout;
  pagoEstado: string | null;
  codigoAlfanumerico: string;
  /** Sigue disponible mientras el pedido espera el pago; si no, `null`. */
  urlRedireccion: string | null;
}

export type EstadoPedidoVisible =
  | 'PENDIENTE_DE_RETIRO'
  | 'ENTREGADO'
  | 'CANCELADO'
  | 'CANCELADO_POR_FALTA_RETIRO';

export interface PedidoResumenItem {
  titulo: string;
  cantidad: number;
}

export interface PedidoResumen {
  idPedido: string;
  codigoAlfanumerico: string;
  estado: EstadoPedidoVisible | 'PENDIENTE_PAGO';
  fechaPedido: string;
  /** Monto como string con 2 decimales (nunca `number`). */
  total: string;
  comercio: { idComercio: string; nombre: string } | null;
  franjaHorario: { inicio: string; fin: string } | null;
  itemsCantidad: number;
  items: PedidoResumenItem[];
}

export interface PedidoTicketItem {
  id: string;
  titulo: string;
  imagen: string | null;
  cantidad: number;
  /** Monto como string con 2 decimales (nunca `number`). */
  precioUnitario: string;
  subtotal: string;
}

/**
 * Contrato exacto que consume `Ticket.tsx` (Pantalla 22). Los montos viajan
 * como string con 2 decimales; la UI los convierte recién al formatear.
 *
 * Incluye `PENDIENTE_PAGO`: el ticket se muestra sin QR para poder reintentar
 * el pago desde la pantalla.
 */
export interface PedidoTicket {
  idPedido: string;
  codigoAlfanumerico: string;
  codigoQR: string;
  estado: EstadoPedidoVisible | 'PENDIENTE_PAGO';
  fechaPedido: string;
  fechaEntrega: string | null;
  subtotal: string;
  tarifaServicio: string;
  total: string;
  comercio: { idComercio: string; nombre: string } | null;
  franjaHorario: { inicio: string; fin: string } | null;
  localAbierto: boolean | null;
  pagoEstado: string | null;
  items: PedidoTicketItem[];
  calificacion: {
    id: number;
    puntaje: number;
    comentario: string | null;
    fecha: string;
  } | null;
  misReportes: Array<{
    id: number;
    motivo: string;
    estado: string;
    fecha: string;
  }>;
}

export interface PedidoComercioItem {
  titulo: string;
  cantidad: number;
}

/** Pedido visible para el panel de mostrador del comerciante (CU-2.06). */
export interface PedidoComercio {
  idPedido: string;
  codigoAlfanumerico: string;
  estado: EstadoPedidoVisible | 'PENDIENTE_PAGO';
  fechaPedido: string;
  fechaEntrega: string | null;
  /** Monto como string con 2 decimales (nunca `number`). */
  total: string;
  cliente: { nombre: string; apellido: string } | null;
  pagoEstado: string | null;
  items: PedidoComercioItem[];
}

/** Resultado de validar un código en el mostrador antes de entregar. */
export interface EntregaValidada {
  pedido: PedidoComercio;
  puedeEntregar: boolean;
  motivo: string | null;
}
