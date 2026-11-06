import { Button, Loader } from '@mantine/core';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api';
import { useAuth } from '../auth/contexto';
import {
  detalleOfertaApi,
  type CanastaResumen,
} from './detalleOfertaApi';
import { resolverImagen } from './api';
import './comercios.css';

const moneda = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
});

function mensajeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return 'No pudimos cargar la canasta.';
}

export function CanastaPage() {
  const { comercioId } = useParams<{ comercioId: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [canasta, setCanasta] = useState<CanastaResumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const parametrosInvalidos = !comercioId || !token;

  useEffect(() => {
    if (parametrosInvalidos) return;

    let activo = true;

    detalleOfertaApi
      .obtenerCanasta(token, comercioId)
      .then((data) => {
        if (!activo) return;

        setCanasta(data);
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
  }, [comercioId, parametrosInvalidos, token]);

  if (parametrosInvalidos) {
    return (
      <main className="comercio-page canasta-page">
        <section className="card">
          <div className="panel panel--bad">
            No se pudo identificar la canasta.
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
      <main className="comercio-page canasta-page">
        <div className="tienda-cargando">
          <Loader color="brand" />
        </div>
      </main>
    );
  }

  if (error || !canasta) {
    return (
      <main className="comercio-page canasta-page">
        <section className="card">
          <div className="panel panel--bad">
            {error || 'No pudimos cargar la canasta.'}
          </div>

          <Button
            fullWidth
            mt="md"
            onClick={() =>
              navigate(`/comercios/${comercioId}`)
            }
          >
            Volver al comercio
          </Button>
        </section>
      </main>
    );
  }

  const estaVacia = canasta.items.length === 0;

  return (
    <main className="comercio-page canasta-page">
      <button
        type="button"
        className="chip"
        onClick={() =>
          navigate(`/comercios/${comercioId}`)
        }
      >
        ← Volver al comercio
      </button>

      <section className="card canasta-cabecera">
        <h1>Mi canasta</h1>

        <p className="muted">
          {canasta.comercio?.nombreFantasia ?? 'Comercio'}
        </p>
      </section>

      {estaVacia ? (
        <section className="card canasta-vacia">
          <h2>Tu canasta está vacía</h2>

          <p className="muted">
            Agregá productos desde el catálogo del comercio.
          </p>

          <Button
            mt="md"
            onClick={() =>
              navigate(`/comercios/${comercioId}`)
            }
          >
            Explorar ofertas
          </Button>
        </section>
      ) : (
        <section className="canasta-layout">
          <div className="card canasta-items">
            <h2>Productos seleccionados</h2>

            {canasta.items.map((item) => {
              const imagen = resolverImagen(item.producto.imagen);

              return (
                <article
                  className="canasta-item"
                  key={item.idCanastaItem}
                >
                  <div className="canasta-item__imagen">
                    {imagen ? (
                      <img
                        src={imagen}
                        alt={item.producto.titulo}
                      />
                    ) : (
                      <span>Sin imagen</span>
                    )}
                  </div>

                  <div className="canasta-item__contenido">
                    <h3>{item.producto.titulo}</h3>

                    <p className="muted">
                      Precio unitario:{' '}
                      {moneda.format(
                        Number(item.precioUnitario),
                      )}
                    </p>

                    <p className="canasta-item__cantidad">
                      Cantidad: <strong>{item.cantidad}</strong>
                    </p>
                  </div>

                  <strong className="canasta-item__subtotal">
                    {moneda.format(Number(item.subtotal))}
                  </strong>
                </article>
              );
            })}
          </div>

          <aside className="card canasta-resumen">
            <h2>Resumen</h2>

            <div className="canasta-resumen__fila">
              <span>Productos</span>
              <strong>{canasta.items.length}</strong>
            </div>

            <div className="canasta-resumen__total">
              <span>Subtotal</span>
              <strong>{moneda.format(Number(canasta.subtotal))}</strong>
            </div>

            <Button
              fullWidth
              mt="md"
              onClick={() =>
                navigate(`/comercios/${comercioId}`)
              }
            >
              Seguir comprando
            </Button>
          </aside>
        </section>
      )}
    </main>
  );
}