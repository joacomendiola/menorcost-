const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

export type Rol = 'CLIENTE' | 'COMERCIANTE' | 'ADMINISTRADOR';

export type EstadoUsuario =
  | 'HABILITADO'
  | 'PENDIENTE_VERIFICACION'
  | 'SUSPENDIDO'
  | 'SOLICITUD_BAJA_PENDIENTE'
  | 'BAJO_INVESTIGACION'
  | 'DOCUMENTACION_RECHAZADA';

export interface UsuarioPublico {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: Rol;
  estado: EstadoUsuario;
}

export interface Direccion {
  id: string;
  usuarioId: string;
  etiqueta: string;
  calle: string;
  numero: string;
  piso: string | null;
  localidad: string;
  descripcion: string | null;
  latitud: string | number;
  longitud: string | number;
  esPredeterminada: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Perfil {
  id: string;
  dni: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  fechaNacimiento: string;
  rol: Rol;
  estado: EstadoUsuario;
  createdAt: string;
  direcciones: Direccion[];
}

export interface Bloqueo {
  tipo: string;
  message: string;
}

export interface DireccionPayload {
  etiqueta: string;
  calle: string;
  numero: string;
  piso?: string;
  localidad: string;
  descripcion?: string;
  latitud: number;
  longitud: number;
}

export interface RegistroPayload {
  dni: string;
  nombre: string;
  apellido: string;
  fechaNacimiento: string;
  telefono: string;
  email: string;
  password: string;
  direccion?: DireccionPayload;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  bloqueos?: Bloqueo[];

  constructor(
    status: number,
    message: string,
    extras?: { code?: string; bloqueos?: Bloqueo[] },
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = extras?.code;
    this.bloqueos = extras?.bloqueos;
  }
}

interface Opciones {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
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

export async function api<T>(
  path: string,
  { method = 'GET', body, token }: Opciones = {},
): Promise<T> {
  let respuesta: Response;

  try {
    respuesta = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      0,
      'No pudimos conectarnos con el servidor. Verificá tu conexión e intentá de nuevo.',
    );
  }

  const texto = await respuesta.text();
  const data = texto ? (JSON.parse(texto) as unknown) : null;

  if (!respuesta.ok) {
    const payload = (data ?? {}) as {
      code?: string;
      bloqueos?: Bloqueo[];
    };
    throw new ApiError(
      respuesta.status,
      extraerMensaje(data, respuesta.status),
      { code: payload.code, bloqueos: payload.bloqueos },
    );
  }

  return data as T;
}

export const authApi = {
  login: (email: string, password: string) =>
    api<{ accessToken: string; usuario: UsuarioPublico }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),

  registro: (payload: RegistroPayload) =>
    api<{ message: string; email: string }>('/auth/registro', {
      method: 'POST',
      body: payload,
    }),

  verificarCuenta: (email: string, codigo: string) =>
    api<{ accessToken: string; usuario: UsuarioPublico }>(
      '/auth/verificar-cuenta',
      { method: 'POST', body: { email, codigo } },
    ),

  reenviarCodigo: (email: string) =>
    api<{ message: string }>('/auth/reenviar-codigo', {
      method: 'POST',
      body: { email },
    }),

  olvidarPassword: (email: string) =>
    api<{ message: string }>('/auth/olvidar-password', {
      method: 'POST',
      body: { email },
    }),

  restablecerPassword: (token: string, password: string) =>
    api<{ message: string }>('/auth/restablecer-password', {
      method: 'POST',
      body: { token, password },
    }),
};

export const usuariosApi = {
  perfil: (token: string) => api<Perfil>('/usuarios/me', { token }),

  actualizar: (
    token: string,
    data: { nombre?: string; apellido?: string; telefono?: string },
  ) =>
    api<Omit<Perfil, 'direcciones'>>('/usuarios/me', {
      method: 'PATCH',
      body: data,
      token,
    }),
};

export const direccionesApi = {
  listar: (token: string) => api<Direccion[]>('/direcciones', { token }),

  crear: (token: string, data: DireccionPayload) =>
    api<Direccion>('/direcciones', { method: 'POST', body: data, token }),

  actualizar: (token: string, id: string, data: DireccionPayload) =>
    api<Direccion>(`/direcciones/${id}`, {
      method: 'PATCH',
      body: data,
      token,
    }),

  eliminar: (token: string, id: string) =>
    api<{ message: string }>(`/direcciones/${id}`, {
      method: 'DELETE',
      token,
    }),

  marcarPredeterminada: (token: string, id: string) =>
    api<Direccion>(`/direcciones/${id}/predeterminada`, {
      method: 'PATCH',
      token,
    }),
};

export const bajasApi = {
  solicitar: (token: string, motivo: string, password: string) =>
    api<{ message: string }>('/baja-cuenta', {
      method: 'POST',
      body: { motivo, password },
      token,
    }),
};
