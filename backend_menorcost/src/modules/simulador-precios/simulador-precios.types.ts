export interface SimulacionPrecioInput {
  /** Precio que el comerciante desea recibir como neto. */
  precioBaseNeto: string;
  /** Tasa de comisión de Menorcost obtenida por el Service desde la BD. */
  comisionMenorcostTasa: string;
  /** Tasa estimada de Mercado Pago obtenida por el Service desde la constante. */
  tasaMpEstimada: string;
  /** Precio de lista original, opcional, para calcular el ahorro. */
  precioLista?: string;
}

export interface SimulacionPrecioResultado {
  precioBaseNeto: string;
  comisionMenorcostTasa: string;
  comisionMenorcostMonto: string;
  tasaMpEstimada: string;
  comisionMpEstimada: string;
  precioPublico: string;
  netoEstimadoComerciante: string;
  ahorroPorcentaje?: string;
  advertenciaNeto: string;
}
