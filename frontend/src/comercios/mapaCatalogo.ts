export interface OfertaMapa {
  id: string;
  titulo: string;
  precioPublico: number | string;
  comercio: {
    id: string;
    nombreFantasia: string;
    latitud: number | string;
    longitud: number | string;
    abierto: boolean;
  };
}

export interface ComercioMapa {
  id: string;
  nombreFantasia: string;
  latitud: number;
  longitud: number;
  abierto: boolean;
  ofertas: OfertaMapa[];
}

export function agruparOfertasPorComercio(ofertas: OfertaMapa[]): ComercioMapa[] {
  const comercios = new Map<string, ComercioMapa>();
  for (const oferta of ofertas) {
    const { comercio } = oferta;
    const existente = comercios.get(comercio.id);
    if (existente) {
      existente.ofertas.push(oferta);
    } else {
      comercios.set(comercio.id, {
        id: comercio.id,
        nombreFantasia: comercio.nombreFantasia,
        latitud: Number(comercio.latitud),
        longitud: Number(comercio.longitud),
        abierto: comercio.abierto,
        ofertas: [oferta],
      });
    }
  }
  return [...comercios.values()];
}
