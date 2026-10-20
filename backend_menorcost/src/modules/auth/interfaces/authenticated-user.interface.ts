import type { EstadoUsuario, Rol } from '../../../generated/prisma/enums.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  rol: Rol;
  estado: EstadoUsuario;
  comercioId?: string | null;
}
