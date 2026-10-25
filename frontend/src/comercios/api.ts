import { ApiError } from '../api';

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:3000';

export type EstadoComercio =
  | 'PENDIENTE_VERIFICACION'
  | 'HABILITADO'
  | 'DOCUMENTACION_RECHAZADA'
  | 'SUSPENDIDO';

export interface HorarioAtencion {
  id: string;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
}

export interface FranjaRetiro extends HorarioAtencion {
  activa: boolean;
}

export interface Comercio {
  id: string;
  mercadoPagoVinculado: boolean;
  nombreFantasia: string;
  razonSocial: string;
  cuit: string;
  telefono: string;
  descripcion: string | null;
  calle: string;
  numero: string;
  piso: string | null;
  localidad: string;
  provincia: string;
  codigoPostal: string | null;
  latitud: string | number;
  longitud: string | number;
  googlePlaceId: string;
  logoUrl: string | null;
  portadaUrl: string | null;
  abierto: boolean;
  estado: EstadoComercio;
  createdAt: string;
  updatedAt: string;
  horarios: HorarioAtencion[];
  franjas: FranjaRetiro[];
}

export interface ComercioPayload {
  nombreFantasia: string;
  razonSocial: string;
  cuit: string;
  telefono: string;
  descripcion?: string;
  calle: string;
  numero: string;
  piso?: string;
  localidad: string;
  provincia: string;
  codigoPostal?: string;
  latitud: number;
  longitud: number;
  googlePlaceId: string;
  logoUrl?: string;
  portadaUrl?: string;
}

export interface HorarioPayload {
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
}

export interface FranjaPayload extends HorarioPayload {
  activa?: boolean;
}

export interface ConfiguracionHorariaPayload {
  horarios: HorarioPayload[];
  franjas: FranjaPayload[];
}

export interface PlacesSugerencia {
  placeId: string;
  textoPrincipal: string;
  textoSecundario: string;
  descripcion: string;
}

export interface PlacesDetalle {
  placeId: string;
  nombre: string;
  direccion: string;
  calle: string;
  numero: string;
  localidad: string;
  provincia: string;
  codigoPostal: string;
  latitud: number;
  longitud: number;
}

type Metodo = 'GET' | 'POST' | 'PATCH' | 'PUT';

interface Opciones {
  method?: Metodo;
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
}

function extraerMensaje(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const data = body as { message?: unknown; error?: unknown };
    if (Array.isArray(data.message)) {
      return data.message.join('. ');
    }
    if (typeof data.message === 'string') {
      return data.message;
    }
    if (typeof data.error === 'string') {
      return data.error;
    }
  }
  return `No pudimos completar la solicitud (${status}).`;
}

async function pedir<T>(
  path: string,
  { method = 'GET', body, token, signal }: Opciones = {},
): Promise<T> {
  let respuesta: Response;

  try {
    respuesta = await fetch(`${API_URL}${path}`, {
      method,
      signal,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw error;
    }
    throw new ApiError(
      0,
      'No pudimos conectarnos con el servidor. Verificá tu conexión e intentá de nuevo.',
    );
  }

  const texto = await respuesta.text();
  let data: unknown = null;

  if (texto) {
    try {
      data = JSON.parse(texto) as unknown;
    } catch {
      data = null;
    }
  }

  if (!respuesta.ok) {
    throw new ApiError(
      respuesta.status,
      extraerMensaje(data, respuesta.status),
    );
  }

  return data as T;
}

export const comerciosApi = {
  mio: async (token: string): Promise<Comercio | null> => {
    try {
      return await pedir<Comercio>('/comercios/mio', { token });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  crear: (token: string, payload: ComercioPayload) =>
    pedir<Comercio>('/comercios', { method: 'POST', body: payload, token }),

  actualizar: (token: string, payload: Partial<ComercioPayload>) =>
    pedir<Comercio>('/comercios/mio', {
      method: 'PATCH',
      body: payload,
      token,
    }),

  cambiarApertura: (token: string, abierto: boolean) =>
    pedir<{ id: string; abierto: boolean }>('/comercios/mio/abierto', {
      method: 'PATCH',
      body: { abierto },
      token,
    }),

  horarios: (token: string) =>
    pedir<HorarioAtencion[]>('/comercios/mio/horarios', { token }),

  guardarHorarios: (token: string, horarios: HorarioPayload[]) =>
    pedir<HorarioAtencion[]>('/comercios/mio/horarios', {
      method: 'PUT',
      body: { horarios },
      token,
    }),

  franjas: (token: string) =>
    pedir<FranjaRetiro[]>('/comercios/mio/franjas', { token }),

  guardarFranjas: (token: string, franjas: FranjaPayload[]) =>
    pedir<FranjaRetiro[]>('/comercios/mio/franjas', {
      method: 'PUT',
      body: { franjas },
      token,
    }),

  guardarConfiguracionHoraria: (
    token: string,
    payload: ConfiguracionHorariaPayload,
  ) =>
    pedir<{ horarios: HorarioAtencion[]; franjas: FranjaRetiro[] }>(
      '/comercios/mio/configuracion-horaria',
      { method: 'PUT', body: payload, token },
    ),
};

export const placesApi = {
  autocompletar: (token: string, texto: string, signal?: AbortSignal) => {
    const parametros = new URLSearchParams({ texto });
    return pedir<PlacesSugerencia[]>(
      `/places/autocompletar?${parametros.toString()}`,
      { token, signal },
    );
  },

  detalle: (token: string, placeId: string) =>
    pedir<PlacesDetalle>(`/places/detalle/${encodeURIComponent(placeId)}`, {
      token,
    }),
};
