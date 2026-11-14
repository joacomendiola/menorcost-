import { describe, expect, it } from 'vitest';
import { agruparOfertasPorComercio } from './mapaCatalogo';

describe('agruparOfertasPorComercio', () => {
  it('crea un marcador por comercio y agrupa sus ofertas', () => {
    const ofertas = [
      { id: 'p1', titulo: 'Pan', precioPublico: 100, comercio: { id: 'c1', nombreFantasia: 'Almacén', latitud: '-34.6', longitud: '-58.4', abierto: true } },
      { id: 'p2', titulo: 'Leche', precioPublico: 200, comercio: { id: 'c1', nombreFantasia: 'Almacén', latitud: '-34.6', longitud: '-58.4', abierto: true } },
      { id: 'p3', titulo: 'Fruta', precioPublico: 300, comercio: { id: 'c2', nombreFantasia: 'Verdulería', latitud: '-34.7', longitud: '-58.5', abierto: false } },
    ];
    const agrupados = agruparOfertasPorComercio(ofertas);
    expect(agrupados).toHaveLength(2);
    expect(agrupados[0].ofertas.map((oferta) => oferta.id)).toEqual(['p1', 'p2']);
    expect(agrupados[0].latitud).toBe(-34.6);
  });
});
