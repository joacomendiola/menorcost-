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

export interface CheckoutRechazado {
  idPedido: string;
  estado: 'RECHAZADO';
  mensaje: string;
}
