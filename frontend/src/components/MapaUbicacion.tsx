import { useEffect, useRef, useState } from 'react';
import type { Map, Marker } from 'maplibre-gl';
import { crearMapa, crearMarcador } from '../mapas/maplibre';

interface MapaUbicacionProps {
  latitud: number;
  longitud: number;
  onChange: (latitud: number, longitud: number) => void;
}

export function MapaUbicacion({
  latitud,
  longitud,
  onChange,
}: MapaUbicacionProps) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<Map | null>(null);
  const marcador = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const [error, setError] = useState('');

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!contenedor.current) return;

    try {
      if (!mapa.current) {
        const instancia = crearMapa(contenedor.current, latitud, longitud, 15);
        const pin = crearMarcador({
          latitud,
          longitud,
          arrastrable: true,
        }).addTo(instancia);

        instancia.on('click', (evento) => {
          const { lat, lng } = evento.lngLat;
          pin.setLngLat([lng, lat]);
          onChangeRef.current(lat, lng);
        });

        pin.on('dragend', () => {
          const posicion = pin.getLngLat();
          onChangeRef.current(posicion.lat, posicion.lng);
        });

        mapa.current = instancia;
        marcador.current = pin;
        return;
      }

      mapa.current.easeTo({ center: [longitud, latitud] });
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
        style={{
          height: 240,
          width: '100%',
          borderRadius: 12,
          display: 'grid',
          placeItems: 'center',
        }}
        role="alert"
      >
        {error}
      </div>
    );
  }

  return (
    <div
      className="mapa-ubicacion"
      style={{
        height: 240,
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        ref={contenedor}
        style={{ height: 240, width: '100%', borderRadius: 12 }}
        aria-label="Mapa de la dirección"
      />
    </div>
  );
}
