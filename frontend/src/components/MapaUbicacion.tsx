import { useEffect, useRef, useState } from 'react';
import { cargarGoogleMaps } from '../comercios/googleMaps';

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
  const mapa = useRef<google.maps.Map | null>(null);
  const marcador = useRef<google.maps.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const [error, setError] = useState('');

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let activo = true;

    cargarGoogleMaps()
      .then((sdk) => {
        if (!activo || !contenedor.current) return;

        if (!mapa.current) {
          const nuevoMapa = new sdk.maps.Map(contenedor.current, {
            center: { lat: latitud, lng: longitud },
            zoom: 15,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            clickableIcons: false,
          });

          const nuevoMarcador = new sdk.maps.Marker({
            map: nuevoMapa,
            position: { lat: latitud, lng: longitud },
            draggable: true,
          });

          nuevoMapa.addListener('click', (event: google.maps.MapMouseEvent) => {
            if (!event.latLng) return;
            const nuevaLatitud = event.latLng.lat();
            const nuevaLongitud = event.latLng.lng();
            nuevoMarcador.setPosition({
              lat: nuevaLatitud,
              lng: nuevaLongitud,
            });
            onChangeRef.current(nuevaLatitud, nuevaLongitud);
          });

          nuevoMarcador.addListener('dragend', () => {
            const posicion = nuevoMarcador.getPosition();
            if (!posicion) return;
            onChangeRef.current(posicion.lat(), posicion.lng());
          });

          mapa.current = nuevoMapa;
          marcador.current = nuevoMarcador;
          return;
        }

        const posicion = { lat: latitud, lng: longitud };
        mapa.current.panTo(posicion);
        marcador.current?.setPosition(posicion);
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
