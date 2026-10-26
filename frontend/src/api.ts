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

export interface Calificacion {
  id: number;
  clienteNombre: string;
  fecha: string;
  puntaje: number;
  comentario: string;
}

export interface ReputacionComercio {
  promedio: number;
  totalResenas: number;
  distribucion: Record<string, number>;
  resenas: Calificacion[];
  paginacion: {
    limit: number;
    nextCursor: number | null;
    hasMore: boolean;
  };
}

export interface ListarResenasQuery {
  limit?: number;
  cursor?: number;
}

export type EstadoPedido =
  | 'PENDIENTE_DE_RETIRO'
  | 'ENTREGADO'
  | 'CANCELADO'
  | 'CANCELADO_POR_FALTA_RETIRO';

export interface PedidoTicketItem {
  id: string;
  titulo: string;
  imagen: string | null;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface PedidoTicket {
  idPedido: string;
  codigoAlfanumerico: string;
  codigoQR: string;
  estado: EstadoPedido;
  fechaPedido: string;
  subtotal: number;
  tarifaServicio: number;
  total: number;
  comercio: { idComercio: string; nombre: string } | null;
  franjaHorario: { inicio: string; fin: string } | null;
  localAbierto: boolean | null;
  items: PedidoTicketItem[];
  calificacion: {
    id: number;
    puntaje: number;
    comentario: string | null;
    fecha: string;
  } | null;
  misReportes: Array<{
    id: number;
    motivo: string;
    estado: string;
    fecha: string;
  }>;
}

export const pedidosApi = {
  obtenerPorCodigo: (token: string, codigo: string) =>
    api<PedidoTicket>(`/pedidos/${encodeURIComponent(codigo)}`, { token }),
};

/* ---------- Reputación (Pantalla 15 + 22) ---------- */

export const reputacionApi = {
  // Pantalla 15
  obtenerMiReputacion: (token: string, query?: ListarResenasQuery) => {
    const params = new URLSearchParams();
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.cursor) params.set('cursor', String(query.cursor));
    const qs = params.toString();
    return api<ReputacionComercio>(
      `/reputation/my-store${qs ? `?${qs}` : ''}`,
      { token },
    );
  },

  // Pantalla 22
  calificar: (
    token: string,
    data: { idPedido: string; puntaje: number; comentario?: string },
  ) =>
    api<{
      calificacion: {
        id_calificacion: number;
        puntaje: number;
        comentario: string | null;
        fecha_creacion: string;
      };
      reputacionComercio: { promedio: number; total: number };
    }>('/reputation/rate', { method: 'POST', body: data, token }),
};

/* ---------- Reportes (Pantalla 22 y 23) ---------- */

export interface ReporteCreado {
  id_reporte: number;
  motivo: string;
  descripcion: string | null;
  estado_reporte: string;
  tipo_destino: 'COMERCIO' | 'CLIENTE';
  fecha_reporte: string;
}

export const reportesApi = {
  crear: (
    token: string,
    data: {
      idPedido: string;
      motivo: string;
      descripcion?: string;
      tipo_destino: 'COMERCIO' | 'CLIENTE';
    },
  ) =>
    api<ReporteCreado>('/reports', { method: 'POST', body: data, token }),

  misReportes: (
    token: string,
    query?: { page?: number; limit?: number; estado?: string },
  ) => {
    const params = new URLSearchParams();
    if (query?.page) params.set('page', String(query.page));
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.estado) params.set('estado', query.estado);
    const qs = params.toString();
    return api<{
      total: number;
      page: number;
      limit: number;
      reportes: Array<{
        id: number;
        motivo: string;
        descripcion: string | null;
        estado: string;
        tipo_destino: string;
        fecha: string;
        comercio: string | null;
      }>;
    }>(`/reports/my-reports${qs ? `?${qs}` : ''}`, { token });
  },
};

export interface AdminKpis {
  altasPendientes: number;
  altasAprobadas30Dias: number;
  bajasSolicitadas: number;
  denunciasAbiertas: number;
}

export interface AdminUsuario {
  id: string;
  dni: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string;
  rol: Rol;
  estado: EstadoUsuario;
  createdAt?: string;
  updatedAt?: string;
  direcciones?: Direccion[];
}

export interface AdminAlta {
  idComercio: string;
  usuarioId: string;
  mercadoPagoVinculado: boolean;
  reputacionPromedio: number;
  totalCalificaciones: number;
  usuario: AdminUsuario & { direcciones: Direccion[] };
}

export type EstadoBaja = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';

export interface AdminBaja {
  id: string;
  usuarioId: string;
  motivo: string;
  estado: EstadoBaja;
  observaciones: string | null;
  createdAt: string;
  updatedAt: string;
  usuario: AdminUsuario;
}

export type EstadoDenuncia =
  | 'PENDIENTE_REVISION'
  | 'BAJO_INVESTIGACION'
  | 'RESUELTO'
  | 'DESESTIMADO';

export interface AdminDenuncia {
  id_reporte: number;
  motivo: string;
  descripcion: string | null;
  estado_reporte: EstadoDenuncia;
  tipo_destino: 'COMERCIO' | 'CLIENTE';
  fecha_reporte: string;
  fecha_resolucion: string | null;
  id_pedido: string;
  id_emisor: string;
  id_denunciado: string;
  id_admin: string | null;
  pedido: {
    id_pedido: string;
    estado: EstadoPedido;
    codigoAlfanumerico: string;
    total: number | string;
  } | null;
  emisor: AdminUsuario;
  denunciado: AdminUsuario;
  admin: AdminUsuario | null;
}

interface AdminNotificacion {
  enviada: boolean;
  aviso?: string;
}

function construirQuery(query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value && value !== 'todos') params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const adminApi = {
  kpis: (token: string) => api<AdminKpis>('/admin/kpis', { token }),

  altas: (token: string, query?: { search?: string; estado?: string }) =>
    api<AdminAlta[]>(`/admin/altas${construirQuery(query ?? {})}`, { token }),

  aprobarAlta: (token: string, idComercio: string) =>
    api<AdminUsuario & { notificacion: AdminNotificacion }>(
      `/admin/altas/${encodeURIComponent(idComercio)}/aprobar`,
      { method: 'PATCH', token },
    ),

  rechazarAlta: (token: string, idComercio: string, motivo: string) =>
    api<AdminUsuario & { notificacion: AdminNotificacion }>(
      `/admin/altas/${encodeURIComponent(idComercio)}/rechazar`,
      { method: 'PATCH', body: { motivo }, token },
    ),

  bajas: (token: string, query?: { estado?: string }) =>
    api<AdminBaja[]>(`/admin/bajas${construirQuery(query ?? {})}`, { token }),

  aprobarBaja: (token: string, id: string) =>
    api<{ message: string }>(
      `/admin/bajas/${encodeURIComponent(id)}/aprobar`,
      { method: 'PATCH', token },
    ),

  rechazarBaja: (token: string, id: string, observaciones?: string) =>
    api<{ message: string }>(
      `/admin/bajas/${encodeURIComponent(id)}/rechazar`,
      {
        method: 'PATCH',
        body: observaciones ? { observaciones } : {},
        token,
      },
    ),

  denuncias: (token: string, query?: { search?: string; estado?: string }) =>
    api<AdminDenuncia[]>(`/admin/denuncias${construirQuery(query ?? {})}`, { token }),

  toggleInvestigacion: (token: string, id: number) =>
    api<Pick<AdminDenuncia, 'id_reporte' | 'estado_reporte'>>(
      `/admin/denuncias/${id}/investigacion`,
      { method: 'PATCH', token },
    ),

  resolverDenuncia: (token: string, id: number) =>
    api<{ success: true }>(`/admin/denuncias/${id}/resolver`, {
      method: 'PATCH',
      token,
    }),

  sancionarDenuncia: (token: string, id: number) =>
    api<{
      reporte: Pick<AdminDenuncia, 'id_reporte' | 'estado_reporte'>;
      usuario: AdminUsuario;
      notificacion: AdminNotificacion;
    }>(`/admin/denuncias/${id}/sancionar`, { method: 'PATCH', token }),
};
