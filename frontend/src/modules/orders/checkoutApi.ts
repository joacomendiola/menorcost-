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
  tarifaServicio: string;
  total: string;
  franjas: CheckoutFranja[];
}

export interface CheckoutConfirmado {
  idPedido: string;
  codigoAlfanumerico: string;
  estado: 'PENDIENTE_DE_RETIRO';
  total: string;
}

/** Solo para el modo simulación. Con Mercado Pago real desaparece. */
export type ResultadoPagoSimulado = 'APROBADO' | 'RECHAZADO';

export interface CrearPedidoPayload {
  comercioId: string;
  franjaHorarioId: string;
  resultadoPagoSimulado?: ResultadoPagoSimulado;
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
