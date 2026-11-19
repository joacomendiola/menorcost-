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

export interface CheckoutConfirmado {
  idPedido: string;
  codigoAlfanumerico: string;
  estado: 'PENDIENTE_DE_RETIRO';
  total: string;
}

export interface CheckoutRechazado {
  idPedido: string;
  estado: 'RECHAZADO';
  message: string;
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
  estado: EstadoPedidoVisible;
  fechaPedido: string;
  total: number;
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
  precioUnitario: number;
  subtotal: number;
}

/**
 * Contrato exacto que consume `Ticket.tsx` (Pantalla 22). Los montos viajan
 * como número porque la UI los formatea directo con `Intl.NumberFormat`.
 */
export interface PedidoTicket {
  idPedido: string;
  codigoAlfanumerico: string;
  codigoQR: string;
  estado: EstadoPedidoVisible;
  fechaPedido: string;
  subtotal: number;
  tarifaServicio: number;
  total: number;
  comercio: { idComercio: string; nombre: string } | null;
  franjaHorario: { inicio: string; fin: string } | null;
  localAbierto: boolean | null;
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
