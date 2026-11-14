import { Button, Loader } from '@mantine/core';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../api';
import { useAuth } from '../auth/contexto';
import {
  detalleOfertaApi,
  type CanastaResumen,
} from './detalleOfertaApi';
import './comercios.css';

const moneda = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
});

function mensajeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return 'No pudimos cargar tus canastas.';
}

export function ListaCanastasPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [canastas, setCanastas] = useState<CanastaResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const tokenInvalido = !token;

  useEffect(() => {
    if (tokenInvalido) return;

    let activo = true;

    detalleOfertaApi
      .obtenerTodasLasCanastas(token)
      .then((data) => {
        if (!activo) return;

        setCanastas(data);
        setError('');
      })
      .catch((err: unknown) => {
        if (activo) {
          setError(mensajeError(err));
        }
      })
      .finally(() => {
        if (activo) {
          setCargando(false);
        }
      });

    return () => {
      activo = false;
    };
  }, [token, tokenInvalido]);

  if (tokenInvalido) {
    return (
      <main className="comercio-page canastas-page">
        <section className="card">
          <div className="panel panel--bad">
            Necesitás iniciar sesión como cliente.
          </div>

          <Button
            fullWidth
            mt="md"
            onClick={() => navigate('/perfil')}
          >
            Volver al perfil
          </Button>
        </section>
      </main>
    );
  }

  if (cargando) {
    return (
      <main className="comercio-page canastas-page">
        <div className="tienda-cargando">
          <Loader color="brand" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="comercio-page canastas-page">
        <section className="card">
          <div className="panel panel--bad">{error}</div>

          <Button
            fullWidth
            mt="md"
            onClick={() => navigate('/perfil')}
          >
            Volver al perfil
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="comercio-page canastas-page">
      <button
        type="button"
        className="chip"
        onClick={() => navigate('/perfil')}
      >
        ← Volver al perfil
      </button>

      <section className="card canastas-page__cabecera">
        <h1>Mis canastas</h1>

        <p className="muted">
          Seleccioná una canasta para ver sus productos.
        </p>
      </section>

      {canastas.length === 0 ? (
        <section className="card canastas-vacia">
          <h2>No tenés canastas guardadas</h2>

          <p className="muted">
            Explorá los comercios y agregá productos para crear una.
          </p>

          <Button
            mt="md"
            onClick={() => navigate('/perfil')}
          >
            Volver al perfil
          </Button>
        </section>
      ) : (
        <section className="canastas-lista">
          {canastas.map((canasta) => (
            <article
              className="card canasta-resumen-card"
              key={
                canasta.idCanasta ?? canasta.comercioId
              }
            >
              <div>
                <span className="badge badge--blue">
                  Canasta persistente
                </span>

                <h2>
                  {canasta.comercio?.nombreFantasia ??
                    'Comercio no disponible'}
                </h2>

                <p className="muted">
                  {canasta.items.length}{' '}
                  {canasta.items.length === 1
                    ? 'producto'
                    : 'productos'}
                </p>
              </div>

              <div className="canasta-resumen-card__datos">
                <strong>
                  {moneda.format(Number(canasta.subtotal))}
                </strong>

                <Button
                  onClick={() =>
                    navigate(
                      `/canastas/${canasta.comercioId}`,
                    )
                  }
                >
                  Ver canasta
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}