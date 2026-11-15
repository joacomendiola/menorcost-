import { useEffect, useRef, useState } from 'react';
import { cargarGoogleMaps } from './googleMaps';
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
  const mapa = useRef<google.maps.Map | null>(null);
  const marcadores = useRef<google.maps.Marker[]>([]);
  const ventana = useRef<google.maps.InfoWindow | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;

    cargarGoogleMaps()
      .then((sdk) => {
        if (!activo || !contenedor.current) return;

        if (!mapa.current) {
          mapa.current = new sdk.maps.Map(contenedor.current, {
            center: { lat: latitudOrigen, lng: longitudOrigen },
            zoom: 12,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            clickableIcons: false,
          });
          ventana.current = new sdk.maps.InfoWindow();
        }

        const instancia = mapa.current;
        ventana.current?.close();

        for (const marcador of marcadores.current) {
          marcador.setMap(null);
        }
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

          const marcador = new sdk.maps.Marker({
            map: instancia,
            position: {
              lat: comercio.latitud,
              lng: comercio.longitud,
            },
            title: comercio.nombreFantasia,
            label: {
              text: String(comercio.ofertas.length),
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: '700',
            },
          });

          marcador.addListener('click', () => {
            ventana.current?.setContent(popup);
            ventana.current?.open({ anchor: marcador, map: instancia });
          });

          marcadores.current.push(marcador);
        }

        if (comercios.length === 1) {
          instancia.setCenter({
            lat: comercios[0].latitud,
            lng: comercios[0].longitud,
          });
          instancia.setZoom(13);
        } else if (comercios.length > 1) {
          const limites = new sdk.maps.LatLngBounds();
          for (const comercio of comercios) {
            limites.extend({
              lat: comercio.latitud,
              lng: comercio.longitud,
            });
          }
          instancia.fitBounds(limites, 28);
          if ((instancia.getZoom() ?? 0) > 14) {
            instancia.setZoom(14);
          }
        } else {
          instancia.setCenter({ lat: latitudOrigen, lng: longitudOrigen });
          instancia.setZoom(12);
        }
      })
      .catch((err: unknown) => {
        if (!activo) return;
        setError(
          err instanceof Error
            ? err.message
            : 'No pudimos cargar el mapa de Google.',
        );
      });

    return () => {
      activo = false;
    };
  }, [ofertas, latitudOrigen, longitudOrigen]);

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
