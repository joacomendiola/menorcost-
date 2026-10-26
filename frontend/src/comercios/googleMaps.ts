const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
const SCRIPT_ID = 'google-maps-sdk';

let promesa: Promise<typeof google> | null = null;

export function cargarGoogleMaps(): Promise<typeof google> {
  if (window.google?.maps) {
    return Promise.resolve(window.google);
  }

  if (!API_KEY?.trim()) {
    return Promise.reject(
      new Error(
        'Falta configurar VITE_GOOGLE_MAPS_API_KEY para mostrar el mapa.',
      ),
    );
  }

  if (promesa) return promesa;

  promesa = new Promise((resolve, reject) => {
    const existente = document.getElementById(
      SCRIPT_ID,
    ) as HTMLScriptElement | null;

    if (existente) {
      existente.addEventListener('load', () => {
        if (window.google?.maps) {
          resolve(window.google);
        } else {
          reject(new Error('No pudimos inicializar Google Maps.'));
        }
      });
      existente.addEventListener('error', () => {
        promesa = null;
        reject(
          new Error('No pudimos cargar Google Maps. Verificá la API key.'),
        );
      });
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      API_KEY,
    )}&v=weekly&language=es&region=AR`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google);
      } else {
        reject(new Error('No pudimos inicializar Google Maps.'));
      }
    };
    script.onerror = () => {
      promesa = null;
      reject(new Error('No pudimos cargar Google Maps. Verificá la API key.'));
    };

    document.head.appendChild(script);
  });

  return promesa;
}
