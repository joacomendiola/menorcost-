import type { Usuario } from '../../generated/prisma/client.js';
import type { EstadoUsuario, Rol } from '../../generated/prisma/enums.js';

export interface UsuarioPublico {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: Rol;
  estado: EstadoUsuario;
}

export function aUsuarioPublico(usuario: Usuario): UsuarioPublico {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    email: usuario.email,
    rol: usuario.rol,
    estado: usuario.estado,
  };
}
