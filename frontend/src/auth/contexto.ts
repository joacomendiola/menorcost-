import { createContext, useContext } from 'react';
import type { UsuarioPublico } from '../api';

export interface ContextoAuth {
  usuario: UsuarioPublico | null;
  token: string | null;
  cargando: boolean;
  iniciarSesion: (email: string, password: string) => Promise<UsuarioPublico>;
  registrarSesion: (token: string, usuario: UsuarioPublico) => void;
  cerrarSesion: () => void;
  actualizarUsuario: (patch: Partial<UsuarioPublico>) => void;
}

export const AuthContext = createContext<ContextoAuth | null>(null);

export function useAuth(): ContextoAuth {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return contexto;
}
