const RADIO_TIERRA_KM = 6371;

export function calcularDistanciaKm(
  latitudOrigen: number,
  longitudOrigen: number,
  latitudDestino: number,
  longitudDestino: number,
): number {
  const rad = (grados: number) => (grados * Math.PI) / 180;
  const dLat = rad(latitudDestino - latitudOrigen);
  const dLon = rad(longitudDestino - longitudOrigen);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(latitudOrigen)) *
      Math.cos(rad(latitudDestino)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
