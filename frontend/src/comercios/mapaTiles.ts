const URL_TILES_CARTO =
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

export function crearUrlTilesCarto(clave?: string): string {
  const claveLimpia = clave?.trim();
  if (!claveLimpia) return URL_TILES_CARTO;

  return `${URL_TILES_CARTO}?key=${encodeURIComponent(claveLimpia)}`;
}
