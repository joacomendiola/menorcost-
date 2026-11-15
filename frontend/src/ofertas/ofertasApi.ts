export type OfferStatus =
  | 'ACTIVO'
  | 'PAUSADO'
  | 'VENCIDO_ELIMINADO'
  | 'ELIMINADO';

export type ManageableOfferStatus = 'ACTIVO' | 'PAUSADO' | 'ELIMINADO';

export type Offer = {
  id: string;
  comercioId: string;
  categoriaId: string;
  titulo: string;
  descripcion: string;
  fechaVencimiento: string;
  stock: number;
  precioLista: string;
  precioBaseNeto: string;
  precioPublico: string;
  comisionMenorcostTasaAplicada: string;
  tasaMpEstimadaAplicada: string;
  imagen: string;
  estado: OfferStatus;
};

export type OfferDashboardSummary = {
  total: number;
  activas: number;
  pausadas: number;
  proximasAVencer: number;
  vencidas: number;
  sinStock: number;
  unidadesReservadas: number;
};

export const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3000';

export class OfferRequestError extends Error {
  readonly status: number;
  readonly minimumStock?: number;

  constructor(message: string, status: number, minimumStock?: number) {
    super(message);
    this.name = 'OfferRequestError';
    this.status = status;
    this.minimumStock = minimumStock;
  }
}

export function priceToCents(value: string): bigint | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    return null;
  }

  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

export function fechaActualArgentina(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Ushuaia',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const part = (type: string): string | undefined =>
    parts.find((item) => item.type === type)?.value;

  const year = part('year');
  const month = part('month');
  const day = part('day');

  if (!year || !month || !day) {
    throw new Error('No se pudo determinar la fecha actual en Argentina');
  }

  return `${year}-${month}-${day}`;
}

export async function requestOffers<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      throw new Error('El servidor devolvió una respuesta inválida.');
    }
  }

  if (!response.ok) {
    let message = `No se pudo completar la solicitud (${response.status}).`;

    if (
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload
    ) {
      const serverMessage = payload.message;

      if (typeof serverMessage === 'string') {
        message = serverMessage;
      } else if (
        Array.isArray(serverMessage) &&
        serverMessage.every((part) => typeof part === 'string')
      ) {
        message = serverMessage.join('. ');
      }
    }

    const minimumStock =
      typeof payload === 'object' &&
      payload !== null &&
      'minimumStock' in payload &&
      typeof payload.minimumStock === 'number' &&
      Number.isInteger(payload.minimumStock) &&
      payload.minimumStock >= 0
        ? payload.minimumStock
        : undefined;

    throw new OfferRequestError(message, response.status, minimumStock);
  }

  return payload as T;
}
