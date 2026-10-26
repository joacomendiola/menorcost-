import { useEffect, useRef, useState } from 'react';
import { cargarGoogleMaps } from './googleMaps';

interface MapaComercioProps {
  latitud: number;
  longitud: number;
}

export function MapaComercio({ latitud, longitud }: MapaComercioProps) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<google.maps.Map | null>(null);
  const marcador = useRef<google.maps.Marker | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;

    cargarGoogleMaps()
      .then((sdk) => {
        if (!activo || !contenedor.current) return;

        if (!mapa.current) {
          mapa.current = new sdk.maps.Map(contenedor.current, {
            center: { lat: latitud, lng: longitud },
            zoom: 16,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            clickableIcons: false,
          });

          marcador.current = new sdk.maps.Marker({
            map: mapa.current,
            position: { lat: latitud, lng: longitud },
          });
          return;
        }

        mapa.current.panTo({ lat: latitud, lng: longitud });
        mapa.current.setZoom(16);
        marcador.current?.setPosition({ lat: latitud, lng: longitud });
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
  }, [latitud, longitud]);

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
