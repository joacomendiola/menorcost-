import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, api } from '../api';
import { useAuth } from '../auth/contexto';
import { NewOfferForm } from './NewOfertaForm';

type Option = {
  id: string;
  nombre: string;
};

type ComercioPropio = {
  id: string;
  nombreFantasia: string;
};

type Categoria = Option & {
  slug: string;
  orden: number;
};

export function NuevaOfertaPage() {
  const { usuario, token } = useAuth();
  const [comercios, setComercios] = useState<Option[]>([]);
  const [categorias, setCategorias] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);
  const missingSession = usuario?.rol === 'COMERCIANTE' && !token;

  useEffect(() => {
    if (usuario?.rol !== 'COMERCIANTE' || !token) return;

    let active = true;

    void Promise.all([
      api<ComercioPropio>('/comercios/mio', { token }),
      api<Categoria[]>('/categorias'),
    ])
      .then(([comercio, categoriasDisponibles]) => {
        if (!active) return;

        setComercios([
          {
            id: comercio.id,
            nombre: comercio.nombreFantasia,
          },
        ]);
        setCategorias(
          categoriasDisponibles.map(({ id, nombre }) => ({ id, nombre })),
        );
      })
      .catch((error: unknown) => {
        if (!active) return;

        if (error instanceof ApiError && error.status === 404) {
          setLoadError(
            'Todavía no tenés un comercio registrado. Registrá tu comercio antes de publicar ofertas.',
          );
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'No se pudieron cargar los datos para publicar.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token, usuario?.rol, reloadCount]);

  if (usuario?.rol !== 'COMERCIANTE') {
    return (
      <main>
        <h1>Publicar oferta</h1>
        <p role="alert">
          Esta sección está disponible para cuentas de comerciante.
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>Publicar oferta</h1>

      {missingSession && (
        <p role="alert">
          No se encontró una sesión válida. Iniciá sesión nuevamente.
        </p>
      )}

      {loading && !missingSession && (
        <p role="status">Cargando comercios y categorías…</p>
      )}

      {loadError && <p role="alert">{loadError}</p>}

      {loadError.includes('comercio registrado') && (
        <p>
          <Link to="/comercios/registro">Registrar mi comercio</Link>
        </p>
      )}

      {token && loadError && !loading && (
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setLoadError('');
            setReloadCount((count) => count + 1);
          }}
        >
          Reintentar
        </button>
      )}

      {!loading && !loadError && categorias.length === 0 && (
        <p role="alert">
          No hay categorías disponibles para publicar una oferta.
        </p>
      )}

      {!loading && !loadError && comercios.length > 0 && categorias.length > 0 && (
        <NewOfferForm
          token={token ?? ''}
          comercios={comercios}
          categorias={categorias}
        />
      )}
    </main>
  );
}