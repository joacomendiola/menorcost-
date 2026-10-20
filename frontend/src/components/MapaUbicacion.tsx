import L from 'leaflet';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { useEffect } from 'react';
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';

interface MapaUbicacionProps {
  latitud: number;
  longitud: number;
  onChange: (latitud: number, longitud: number) => void;
}

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

const pinIcon = L.divIcon({
  className: 'map-pin',
  html: `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 3px rgba(0,0,0,0.35));">
    <path d="M16 31S5 21.4 5 13.5C5 7.8 9.9 3 16 3s11 4.8 11 10.5C27 21.4 16 31 16 31z" fill="#1E293B"/>
    <circle cx="16" cy="13.5" r="4.5" fill="#FFFFFF"/>
  </svg>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

function ManejadorClic({
  onChange,
}: {
  onChange: (latitud: number, longitud: number) => void;
}) {
  useMapEvents({
    click(event) {
      onChange(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

function Recentrar({ latitud, longitud }: { latitud: number; longitud: number }) {
  const mapa = useMap();

  useEffect(() => {
    mapa.setView([latitud, longitud], mapa.getZoom(), { animate: true });
  }, [latitud, longitud, mapa]);

  return null;
}

function AjustarTamano() {
  const mapa = useMap();

  useEffect(() => {
    const temporizador = setTimeout(() => mapa.invalidateSize(), 150);
    return () => clearTimeout(temporizador);
  }, [mapa]);

  return null;
}

export function MapaUbicacion({
  latitud,
  longitud,
  onChange,
}: MapaUbicacionProps) {
  return (
    <div
      className="mapa-ubicacion"
      style={{
        height: '240px',
        width: '100%',
        borderRadius: '12px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <MapContainer
        center={[latitud, longitud]}
        zoom={15}
        scrollWheelZoom
        style={{ height: '240px', width: '100%', borderRadius: '12px' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <ManejadorClic onChange={onChange} />
        <Marker
          position={[latitud, longitud]}
          draggable={true}
          icon={pinIcon}
          eventHandlers={{
            dragend: (event) => {
              const posicion = (event.target as L.Marker).getLatLng();
              onChange(posicion.lat, posicion.lng);
            },
          }}
        />
        <Recentrar latitud={latitud} longitud={longitud} />
        <AjustarTamano />
      </MapContainer>
    </div>
  );
}
