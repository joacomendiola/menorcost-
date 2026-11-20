import type { PlacesDetalle, PlacesSugerencia } from '../comercios/api';

interface PhotonProperties {
  name?: string;
  street?: string;
  housenumber?: string;
  type?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
  postcode?: string;
  osm_id?: number;
  osm_type?: string;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: PhotonProperties;
}

interface PhotonResponse {
  features: PhotonFeature[];
}

const detalles = new Map<string, PlacesDetalle>();

function valorLocalidad(propiedades: PhotonProperties): string {
  return (
    propiedades.city ??
    propiedades.town ??
    propiedades.village ??
    propiedades.municipality ??
    ''
  );
}

function identificar(feature: PhotonFeature, indice: number): string {
  const { osm_id: osmId, osm_type: osmTipo } = feature.properties;
  if (osmId !== undefined && osmTipo) return `osm-${osmTipo}-${osmId}`;

  const [longitud, latitud] = feature.geometry.coordinates;
  return `coord-${latitud.toFixed(6)}-${longitud.toFixed(6)}-${indice}`;
}

function normalizar(feature: PhotonFeature, id: string): PlacesDetalle {
  const propiedades = feature.properties;
  const calle =
    propiedades.street ??
    (propiedades.type === 'street' ? propiedades.name ?? '' : '');
  const numero = propiedades.housenumber ?? '';
  const localidad = valorLocalidad(propiedades);
  const provincia = propiedades.state ?? '';
  const nombre = propiedades.name || [calle, numero].filter(Boolean).join(' ');
  const direccion = [calle, numero, localidad, provincia]
    .filter(Boolean)
    .join(', ');
  const [longitud, latitud] = feature.geometry.coordinates;

  return {
    placeId: id,
    nombre,
    direccion,
    calle,
    numero,
    localidad,
    provincia,
    codigoPostal: propiedades.postcode ?? '',
    latitud,
    longitud,
  };
}

export async function buscarLugares(
  texto: string,
  signal?: AbortSignal,
): Promise<PlacesSugerencia[]> {
  const parametros = new URLSearchParams({
    q: texto,
    lang: 'default',
    limit: '6',
    bbox: '-73.5,-55.5,-53,-21',
  });

  const respuesta = await fetch(`https://photon.komoot.io/api/?${parametros.toString()}`, {
    signal,
    headers: { Accept: 'application/json' },
  });

  if (!respuesta.ok) {
    throw new Error('No pudimos consultar OpenStreetMap.');
  }

  const datos = (await respuesta.json()) as PhotonResponse;
  const resultados = datos.features.slice(0, 6).map((feature, indice) => {
    const id = identificar(feature, indice);
    const detalle = normalizar(feature, id);
    detalles.set(id, detalle);

    return {
      placeId: id,
      textoPrincipal: detalle.nombre || detalle.direccion || id,
      textoSecundario: detalle.direccion,
      descripcion: detalle.nombre || detalle.direccion || id,
    };
  });

  return resultados;
}

export async function detallePorCoordenadas(
  latitud: number,
  longitud: number,
  signal?: AbortSignal,
): Promise<PlacesDetalle | null> {
  const parametros = new URLSearchParams({
    lon: String(longitud),
    lat: String(latitud),
    limit: '8',
  });

  const respuesta = await fetch(
    `https://photon.komoot.io/reverse?${parametros.toString()}`,
    { signal, headers: { Accept: 'application/json' } },
  );

  if (!respuesta.ok) {
    throw new Error('No pudimos consultar OpenStreetMap.');
  }

  const datos = (await respuesta.json()) as PhotonResponse;
  const feature =
    datos.features.find((item) => item.properties.housenumber) ??
    datos.features[0];
  if (!feature) return null;

  const detalle = normalizar(feature, identificar(feature, 0));
  detalles.set(detalle.placeId, detalle);
  return detalle;
}

export function detalleLugar(placeId: string): PlacesDetalle | null {
  return detalles.get(placeId) ?? null;
}
