import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map, Marker, Popup } from 'maplibre-gl';
import { crearMapa, crearMarcador } from '../mapas/maplibre';
import { agruparOfertasPorComercio, type OfertaMapa } from './mapaCatalogo';

interface Props {
  ofertas: OfertaMapa[];
  latitudOrigen: number;
  longitudOrigen: number;
}

const moneda = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (caracter) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[caracter] ?? caracter);
}

export function MapaExploracion({
  ofertas,
  latitudOrigen,
  longitudOrigen,
}: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<Map | null>(null);
  const marcadores = useRef<Marker[]>([]);
  const ventana = useRef<Popup | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!contenedor.current) return;

    try {
      if (!mapa.current) {
        mapa.current = crearMapa(
          contenedor.current,
          latitudOrigen,
          longitudOrigen,
          12,
        );
      }

      const instancia = mapa.current;
      ventana.current?.remove();
      for (const marcador of marcadores.current) marcador.remove();
      marcadores.current = [];

      const comercios = agruparOfertasPorComercio(ofertas).filter(
        (comercio) =>
          Number.isFinite(comercio.latitud) &&
          Number.isFinite(comercio.longitud),
      );

      for (const comercio of comercios) {
        const lista = comercio.ofertas
          .map(
            (oferta) =>
              `<li><a href="/comercios/${encodeURIComponent(comercio.id)}/productos/${encodeURIComponent(oferta.id)}">${escaparHtml(oferta.titulo)} · ${moneda.format(Number(oferta.precioPublico))}</a></li>`,
          )
          .join('');
        const popup = `<strong>${escaparHtml(comercio.nombreFantasia)}</strong><p>${comercio.abierto ? 'Abierto ahora' : 'Cerrado'} · ${comercio.ofertas.length} ${comercio.ofertas.length === 1 ? 'oferta' : 'ofertas'}</p><ul>${lista}</ul>`;

        const marcador = crearMarcador({
          latitud: comercio.latitud,
          longitud: comercio.longitud,
          etiqueta: String(comercio.ofertas.length),
          titulo: comercio.nombreFantasia,
        }).addTo(instancia);

        marcador.getElement().addEventListener('click', (evento) => {
          evento.stopPropagation();
          ventana.current?.remove();
          ventana.current = new maplibregl.Popup({
            offset: 18,
            maxWidth: '280px',
          })
            .setLngLat([comercio.longitud, comercio.latitud])
            .setHTML(popup)
            .addTo(instancia);
        });

        marcadores.current.push(marcador);
      }

      if (comercios.length === 1) {
        instancia.easeTo({
          center: [comercios[0].longitud, comercios[0].latitud],
          zoom: 13,
        });
      } else if (comercios.length > 1) {
        const limites = new maplibregl.LngLatBounds();
        for (const comercio of comercios) {
          limites.extend([comercio.longitud, comercio.latitud]);
        }
        instancia.fitBounds(limites, { padding: 28, maxZoom: 14 });
      } else {
        instancia.easeTo({
          center: [longitudOrigen, latitudOrigen],
          zoom: 12,
        });
      }
    } catch (err) {
      const mensaje =
        err instanceof Error ? err.message : 'No pudimos cargar el mapa.';
      queueMicrotask(() => setError(mensaje));
    }
  }, [ofertas, latitudOrigen, longitudOrigen]);

  useEffect(
    () => () => {
      ventana.current?.remove();
      for (const marcador of marcadores.current) marcador.remove();
      marcadores.current = [];
      mapa.current?.remove();
      mapa.current = null;
    },
    [],
  );

  if (error) {
    return (
      <div
        className="explorar__map"
        style={{ display: 'grid', placeItems: 'center', padding: 24 }}
        role="alert"
      >
        {error}
      </div>
    );
  }

  return (
    <div
      className="explorar__map"
      ref={contenedor}
      role="region"
      aria-label="Mapa de comercios y ofertas"
    />
  );
}
