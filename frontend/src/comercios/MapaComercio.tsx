import L from 'leaflet';
import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';

const pinIcon = L.divIcon({
  className: 'map-pin',
  html: `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 3px rgba(0,0,0,0.35));">
    <path d="M16 31S5 21.4 5 13.5C5 7.8 9.9 3 16 3s11 4.8 11 10.5C27 21.4 16 31 16 31z" fill="#2F55C8"/>
    <circle cx="16" cy="13.5" r="4.5" fill="#FFFFFF"/>
  </svg>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

function Recentrar({
  latitud,
  longitud,
}: {
  latitud: number;
  longitud: number;
}) {
  const mapa = useMap();

  useEffect(() => {
    mapa.setView([latitud, longitud], 16, { animate: true });
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

interface MapaComercioProps {
  latitud: number;
  longitud: number;
}

export function MapaComercio({ latitud, longitud }: MapaComercioProps) {
  return (
    <div className="mapa-ubicacion" style={{ height: 260 }}>
      <MapContainer
        center={[latitud, longitud]}
        zoom={16}
        scrollWheelZoom
        style={{ height: 260, width: '100%', borderRadius: 12 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <Marker position={[latitud, longitud]} icon={pinIcon} />
        <Recentrar latitud={latitud} longitud={longitud} />
        <AjustarTamano />
      </MapContainer>
    </div>
  );
}
