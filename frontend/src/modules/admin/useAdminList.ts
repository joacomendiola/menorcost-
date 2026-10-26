import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/contexto';
import { esSesionVencida, mensajeError } from './adminFormat';

interface Resultado<T> {
  key: string;
  items: T[];
  error: string | null;
}

/**
 * Carga una lista del backoffice y expone `recargar`.
 * Descarta respuestas obsoletas (cambios rápidos de filtro) y cierra sesión ante un 401.
 * `cargando` se deriva de la clave de la última respuesta, sin setState síncrono en efectos.
 */
export function useAdminList<T>(
  fetcher: (token: string) => Promise<T[]>,
  deps: ReadonlyArray<unknown>,
) {
  const { token, cerrarSesion } = useAuth();
  const [resultado, setResultado] = useState<Resultado<T> | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const claveActual = `${reloadKey}|${JSON.stringify(deps)}`;

  useEffect(() => {
    if (!token) return;
    let cancelado = false;

    fetcherRef
      .current(token)
      .then((items) => {
        if (!cancelado) setResultado({ key: claveActual, items, error: null });
      })
      .catch((err: unknown) => {
        if (cancelado) return;
        if (esSesionVencida(err)) {
          cerrarSesion();
          return;
        }
        setResultado({ key: claveActual, items: [], error: mensajeError(err) });
      });

    return () => {
      cancelado = true;
    };
  }, [token, cerrarSesion, claveActual]);

  const recargar = useCallback(() => setReloadKey((k) => k + 1), []);

  return {
    items: resultado?.items ?? [],
    cargando: resultado?.key !== claveActual,
    error: resultado && resultado.key === claveActual ? resultado.error : null,
    recargar,
  };
}