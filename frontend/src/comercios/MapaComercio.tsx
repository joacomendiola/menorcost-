import { useEffect, useRef, useState } from 'react';
import type { Map, Marker } from 'maplibre-gl';
import { crearMapa, crearMarcador } from '../mapas/maplibre';

interface MapaComercioProps {
  latitud: number;
  longitud: number;
}

export function MapaComercio({ latitud, longitud }: MapaComercioProps) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<Map | null>(null);
  const marcador = useRef<Marker | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!contenedor.current) return;

    try {
      if (!mapa.current) {
        mapa.current = crearMapa(contenedor.current, latitud, longitud, 16);
        marcador.current = crearMarcador({ latitud, longitud }).addTo(
          mapa.current,
        );
        return;
      }

      mapa.current.easeTo({ center: [longitud, latitud], zoom: 16 });
      marcador.current?.setLngLat([longitud, latitud]);
    } catch (err) {
      const mensaje =
        err instanceof Error ? err.message : 'No pudimos cargar el mapa.';
      queueMicrotask(() => setError(mensaje));
    }
  }, [latitud, longitud]);

  useEffect(
    () => () => {
      marcador.current?.remove();
      mapa.current?.remove();
      marcador.current = null;
      mapa.current = null;
    },
    [],
  );

  if (error) {
    return (
      <div
        className="panel panel--warn"
        style={{ height: 260, display: 'grid', placeItems: 'center' }}
        role="alert"
      >
        {error}
      </div>
    );
  }

  return (
    <div className="mapa-ubicacion" style={{ height: 260 }}>
      <div
        ref={contenedor}
        style={{ height: 260, width: '100%', borderRadius: 12 }}
        aria-label="Mapa del comercio"
      />
    </div>
  );
}
