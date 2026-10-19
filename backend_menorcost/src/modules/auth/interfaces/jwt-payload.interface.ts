import type { Rol } from '../../../generated/prisma/enums.js';

export interface JwtPayload {
  sub: string;
  email: string;
  rol: Rol;
  tokenVersion: number;
  comercioId?: string | null;
}
