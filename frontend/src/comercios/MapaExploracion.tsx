import { useEffect, useRef } from 'react';
import L, { type LayerGroup, type Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { agruparOfertasPorComercio, type OfertaMapa } from './mapaCatalogo';
import { crearUrlTilesCarto } from './mapaTiles';

interface Props {
  ofertas: OfertaMapa[];
  latitudOrigen: number;
  longitudOrigen: number;
}

const moneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const urlTiles = crearUrlTilesCarto(
  import.meta.env.VITE_CARTO_BASEMAP_API_KEY as string | undefined,
);

function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (caracter) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[caracter] ?? caracter);
}

export function MapaExploracion({ ofertas, latitudOrigen, longitudOrigen }: Props) {
  const elemento = useRef<HTMLDivElement>(null);
  const mapa = useRef<LeafletMap | null>(null);
  const marcadores = useRef<LayerGroup | null>(null);

  useEffect(() => {
    if (!elemento.current) return;
    const instancia = L.map(elemento.current, { scrollWheelZoom: false })
      .setView([latitudOrigen, longitudOrigen], 12);
    L.tileLayer(urlTiles, {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
    }).addTo(instancia);
    mapa.current = instancia;
    marcadores.current = L.layerGroup().addTo(instancia);
    return () => {
      instancia.remove();
      mapa.current = null;
      marcadores.current = null;
    };
  }, [latitudOrigen, longitudOrigen]);

  useEffect(() => {
    const instancia = mapa.current;
    const grupo = marcadores.current;
    if (!instancia || !grupo) return;
    grupo.clearLayers();
    const comercios = agruparOfertasPorComercio(ofertas).filter(
      (comercio) => Number.isFinite(comercio.latitud) && Number.isFinite(comercio.longitud),
    );
    for (const comercio of comercios) {
      const lista = comercio.ofertas.map((oferta) =>
        `<li><a href="/comercios/${encodeURIComponent(comercio.id)}/productos/${encodeURIComponent(oferta.id)}">${escaparHtml(oferta.titulo)} · ${moneda.format(Number(oferta.precioPublico))}</a></li>`,
      ).join('');
      const popup = `<strong>${escaparHtml(comercio.nombreFantasia)}</strong><p>${comercio.abierto ? 'Abierto ahora' : 'Cerrado'} · ${comercio.ofertas.length} ${comercio.ofertas.length === 1 ? 'oferta' : 'ofertas'}</p><ul>${lista}</ul>`;
      L.marker([comercio.latitud, comercio.longitud], {
        icon: L.divIcon({
          className: 'explorar-map-pin',
          html: `<span>${comercio.ofertas.length}</span>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
      }).addTo(grupo).bindPopup(popup);
    }
    if (comercios.length === 1) {
      instancia.setView([comercios[0].latitud, comercios[0].longitud], 13);
    } else if (comercios.length > 1) {
      const lats = comercios.map(({ latitud }) => latitud);
      const lons = comercios.map(({ longitud }) => longitud);
      instancia.fitBounds([[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]], { padding: [28, 28], maxZoom: 14 });
    } else {
      instancia.setView([latitudOrigen, longitudOrigen], 12);
    }
  }, [ofertas, latitudOrigen, longitudOrigen]);

  return <div className="explorar__map" ref={elemento} role="region" aria-label="Mapa de comercios y ofertas" />;
}
