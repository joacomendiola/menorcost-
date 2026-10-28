export interface SimularPrecioPayload {
  precioBaseNeto: string;
  precioLista?: string;
}

export interface SimulacionPrecio {
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

export interface EstadoSimuladorPrecios {
  resultado: SimulacionPrecio | null;
  error: string;
  cargando: boolean;
}
