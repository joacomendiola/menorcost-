import { useEffect, useRef, useState } from 'react';
import type { Map, Marker } from 'maplibre-gl';
import { detallePorCoordenadas } from '../mapas/geocoding';
import { crearMapa, crearMarcador } from '../mapas/maplibre';
import type { PlacesDetalle } from '../comercios/api';

interface MapaUbicacionProps {
  latitud: number;
  longitud: number;
  onChange: (latitud: number, longitud: number) => void;
  onDireccion?: (detalle: PlacesDetalle) => void;
}

export function MapaUbicacion({
  latitud,
  longitud,
  onChange,
  onDireccion,
}: MapaUbicacionProps) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<Map | null>(null);
  const marcador = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const onDireccionRef = useRef(onDireccion);
  const controlador = useRef<AbortController | null>(null);
  const [error, setError] = useState('');
  const [buscandoDireccion, setBuscandoDireccion] = useState(false);
  const [errorDireccion, setErrorDireccion] = useState('');

  useEffect(() => {
    onChangeRef.current = onChange;
    onDireccionRef.current = onDireccion;
  }, [onChange, onDireccion]);

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

        const actualizar = (lat: number, lng: number) => {
          onChangeRef.current(lat, lng);
          if (!onDireccionRef.current) return;

          controlador.current?.abort();
          const peticion = new AbortController();
          controlador.current = peticion;
          setBuscandoDireccion(true);
          setErrorDireccion('');

          detallePorCoordenadas(lat, lng, peticion.signal)
            .then((detalle) => {
              if (peticion.signal.aborted || !detalle) return;
              onDireccionRef.current?.(detalle);
            })
            .catch((err: unknown) => {
              if ((err as Error).name === 'AbortError') return;
              setErrorDireccion(
                'No pudimos completar la dirección automáticamente.',
              );
            })
            .finally(() => {
              if (controlador.current === peticion) {
                setBuscandoDireccion(false);
              }
            });
        };

        instancia.on('click', (evento) => {
          const { lat, lng } = evento.lngLat;
          pin.setLngLat([lng, lat]);
          actualizar(lat, lng);
        });

        pin.on('dragend', () => {
          const posicion = pin.getLngLat();
          actualizar(posicion.lat, posicion.lng);
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
      controlador.current?.abort();
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

      {(buscandoDireccion || errorDireccion) && (
        <div
          className="help"
          role={errorDireccion ? 'alert' : undefined}
          style={{
            position: 'absolute',
            left: 10,
            bottom: 10,
            margin: 0,
            padding: '4px 8px',
            borderRadius: 8,
            background: 'rgba(255, 255, 255, 0.9)',
            pointerEvents: 'none',
          }}
        >
          {buscandoDireccion
            ? 'Completando dirección…'
            : errorDireccion}
        </div>
      )}
    </div>
  );
}
