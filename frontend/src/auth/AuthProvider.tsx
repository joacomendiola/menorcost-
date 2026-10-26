import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, authApi, usuariosApi } from '../api';
import type { Perfil, UsuarioPublico } from '../api';
import { AuthContext } from './contexto';

const STORAGE_KEY = 'menorcost.sesion';

interface Sesion {
  token: string;
  usuario: UsuarioPublico;
}

function leerSesion(): Sesion | null {
  try {
    const crudo = localStorage.getItem(STORAGE_KEY);
    if (!crudo) return null;
    const data = JSON.parse(crudo) as Partial<Sesion>;
    if (!data.token || !data.usuario) return null;
    return { token: data.token, usuario: data.usuario };
  } catch {
    return null;
  }
}

function persistir(sesion: Sesion | null): void {
  if (sesion) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sesion));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function aUsuarioPublico(perfil: Perfil): UsuarioPublico {
  return {
    id: perfil.id,
    nombre: perfil.nombre,
    apellido: perfil.apellido,
    email: perfil.email,
    rol: perfil.rol,
    estado: perfil.estado,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(() => leerSesion());
  const [cargando, setCargando] = useState<boolean>(() => leerSesion() !== null);

  const guardarSesion = useCallback((nueva: Sesion | null) => {
    persistir(nueva);
    setSesion(nueva);
  }, []);

  useEffect(() => {
    const guardada = leerSesion();
    if (!guardada) {
      return;
    }

    let activo = true;

    usuariosApi
      .perfil(guardada.token)
      .then((perfil) => {
        if (!activo) return;
        guardarSesion({
          token: guardada.token,
          usuario: aUsuarioPublico(perfil),
        });
      })
      .catch((error: unknown) => {
        if (!activo) return;
        if (error instanceof ApiError && error.status === 401) {
          guardarSesion(null);
        }
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [guardarSesion]);

  const iniciarSesion = useCallback(
    async (email: string, password: string) => {
      const data = await authApi.login(email, password);
      guardarSesion({ token: data.accessToken, usuario: data.usuario });
      return data.usuario;
    },
    [guardarSesion],
  );

  const registrarSesion = useCallback(
    (token: string, usuario: UsuarioPublico) => {
      guardarSesion({ token, usuario });
    },
    [guardarSesion],
  );

  const cerrarSesion = useCallback(() => {
    guardarSesion(null);
  }, [guardarSesion]);

  const actualizarUsuario = useCallback((patch: Partial<UsuarioPublico>) => {
    setSesion((prev) => {
      if (!prev) return prev;
      const siguiente: Sesion = {
        ...prev,
        usuario: { ...prev.usuario, ...patch },
      };
      persistir(siguiente);
      return siguiente;
    });
  }, []);

  const valor = useMemo(
    () => ({
      usuario: sesion?.usuario ?? null,
      token: sesion?.token ?? null,
      cargando,
      iniciarSesion,
      registrarSesion,
      cerrarSesion,
      actualizarUsuario,
    }),
    [
      sesion,
      cargando,
      iniciarSesion,
      registrarSesion,
      cerrarSesion,
      actualizarUsuario,
    ],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}
