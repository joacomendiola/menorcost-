import * as maplibregl from 'maplibre-gl';
import type { Map, Marker } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';

maplibregl.setWorkerUrl(workerUrl);

export const ESTILO_MAPA = 'https://tiles.openfreemap.org/styles/liberty';

export const ESTILO_MAPA_RESPALDO: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap © CARTO',
    },
  },
  layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
};

const ATRIBUCION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a> · <a href="https://tiles.openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> / <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>';

interface OpcionesPin {
  latitud: number;
  longitud: number;
  etiqueta?: string;
  titulo?: string;
  arrastrable?: boolean;
}

export function crearMapa(
  contenedor: HTMLElement,
  latitud: number,
  longitud: number,
  zoom: number,
  onError?: (error: Error) => void,
): Map {
  const mapa = new maplibregl.Map({
    container: contenedor,
    style: ESTILO_MAPA,
    center: [longitud, latitud],
    zoom,
    attributionControl: false,
  });

  mapa.addControl(
    new maplibregl.AttributionControl({
      compact: true,
      customAttribution: ATRIBUCION,
    }),
    'bottom-right',
  );
  mapa.addControl(
    new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }),
    'top-right',
  );

  // Los errores de red del estilo/tiles no lanzan excepciones: MapLibre los
  // notifica mediante el evento 'error'. Si OpenFreeMap falla, usamos un
  // estilo raster alternativo para no dejar el mapa sin calles.
  let usaRespaldo = false;
  mapa.on('error', (evento) => {
    if (usaRespaldo) return;
    usaRespaldo = true;
    const error =
      evento.error instanceof Error
        ? evento.error
        : new Error(String(evento.error ?? 'Error al cargar el mapa'));
    try {
      mapa.setStyle(ESTILO_MAPA_RESPALDO);
    } catch (errorAplicarRespaldo) {
      console.error('No se pudo aplicar el estilo de respaldo.', errorAplicarRespaldo);
    }
    console.warn('No se pudo cargar OpenFreeMap; se usa el mapa de respaldo.', error);
    onError?.(error);
  });

  return mapa;
}

export function crearMarcador({
  latitud,
  longitud,
  etiqueta,
  titulo,
  arrastrable = false,
}: OpcionesPin): Marker {
  const elemento = document.createElement('div');
  elemento.className = etiqueta
    ? 'maplibre-pin maplibre-pin--numero'
    : 'maplibre-pin';

  if (etiqueta) {
    elemento.textContent = etiqueta;
  } else {
    elemento.innerHTML = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 31S5 21.4 5 13.5C5 7.8 9.9 3 16 3s11 4.8 11 10.5C27 21.4 16 31 16 31z" fill="#1e293b"/><circle cx="16" cy="13.5" r="4.5" fill="#fff"/></svg>`;
  }

  if (titulo) elemento.title = titulo;

  return new maplibregl.Marker({
    element: elemento,
    anchor: 'bottom',
    draggable: arrastrable,
  }).setLngLat([longitud, latitud]);
}
