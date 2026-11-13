import { Button, Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api';
import { useAuth } from '../auth/contexto';
import { MapaComercio } from './MapaComercio';
import { resolverImagen } from './api';
import {
  detalleOfertaApi,
  type DetalleOferta,
} from './detalleOfertaApi';
import './comercios.css';

const moneda = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
});

function numero(valor: string | number): number {
  return Number(valor);
}

function fechaExacta(fecha: string): string {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function calcularDescuento(oferta: DetalleOferta): number {
  const lista = numero(oferta.producto.precioLista);
  const promocional = numero(oferta.producto.precioPublico);

  if (lista <= 0 || promocional >= lista) return 0;

  return Math.round((1 - promocional / lista) * 100);
}

function distanciaEnKilometros(
  latitudInicial: number,
  longitudInicial: number,
  latitudFinal: number,
  longitudFinal: number,
): number {
  const radioTierra = 6371;
  const gradosARadianes = (grados: number) => (grados * Math.PI) / 180;
  const diferenciaLatitud = gradosARadianes(
    latitudFinal - latitudInicial,
  );
  const diferenciaLongitud = gradosARadianes(
    longitudFinal - longitudInicial,
  );

  const a =
    Math.sin(diferenciaLatitud / 2) ** 2 +
    Math.cos(gradosARadianes(latitudInicial)) *
      Math.cos(gradosARadianes(latitudFinal)) *
      Math.sin(diferenciaLongitud / 2) ** 2;

  return radioTierra * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mensajeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return 'La oferta no existe o ya no está disponible.';
    }

    if (error.status === 410) {
      return 'Producto vencido. Te redirigiremos al catálogo.';
    }

    return error.message;
  }

  return 'No pudimos cargar el detalle de la oferta.';
}

export function DetalleOfertaPage() {
  const { comercioId, productoId } = useParams<{
    comercioId: string;
    productoId: string;
  }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [oferta, setOferta] = useState<DetalleOferta | null>(null);
  const [cargando, setCargando] = useState(
    Boolean(comercioId && productoId),
  );
  const [error, setError] = useState(
    comercioId && productoId
      ? ''
      : 'La oferta solicitada no existe.',
  );
  const [recargar, setRecargar] = useState(0);
  const [agregando, setAgregando] = useState(false);
  const [cantidad, setCantidad] = useState(1);
  const [ubicacion, setUbicacion] = useState<{
    latitud: number;
    longitud: number;
  } | null>(null);

  useEffect(() => {
    if (!comercioId || !productoId) return;

    let activo = true;

    detalleOfertaApi
      .obtener(comercioId, productoId)
      .then((data) => {
        if (!activo) return;
        setOferta(data);
        setCantidad(1);
        setError('');
      })
      .catch((err: unknown) => {
        if (!activo) return;
        setError(mensajeError(err));

        if (err instanceof ApiError && err.status === 410) {
          window.setTimeout(() => {
            if (activo) navigate(`/comercios/${comercioId}`);
          }, 1800);
        }
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [comercioId, productoId, recargar, navigate]);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        setUbicacion({
          latitud: posicion.coords.latitude,
          longitud: posicion.coords.longitude,
        });
      },
      () => {
        setUbicacion(null);
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 300000,
      },
    );
  }, []);

  const descuento = useMemo(
    () => (oferta ? calcularDescuento(oferta) : 0),
    [oferta],
  );

  const ahorro = useMemo(() => {
    if (!oferta) return 0;

    return Math.max(
      0,
      numero(oferta.producto.precioLista) -
        numero(oferta.producto.precioPublico),
    );
  }, [oferta]);

  const subtotalSeleccionado = useMemo(() => {
    if (!oferta) return 0;

    return numero(oferta.producto.precioPublico) * cantidad;
  }, [oferta, cantidad]);

  const distancia = useMemo(() => {
    if (!oferta || !ubicacion) return null;

    return distanciaEnKilometros(
      ubicacion.latitud,
      ubicacion.longitud,
      oferta.comercio.latitud,
      oferta.comercio.longitud,
    );
  }, [oferta, ubicacion]);

  async function agregarACanasta() {
    if (!oferta || !comercioId || !token) {
      notifications.show({
        color: 'red',
        message: 'Necesitás iniciar sesión como cliente.',
      });
      return;
    }

    if (oferta.producto.stock <= 0) {
      notifications.show({
        color: 'red',
        message: 'Producto sin stock.',
      });
      navigate(`/comercios/${comercioId}`);
      return;
    }

    if (cantidad > oferta.producto.stock) {
      notifications.show({
        color: 'red',
        message: 'La cantidad seleccionada supera el stock disponible.',
      });
      setCantidad(oferta.producto.stock);
      return;
    }

    setAgregando(true);

    try {
      await detalleOfertaApi.agregarACanasta(
        token,
        comercioId,
        oferta.producto.id,
        cantidad,
      );

      notifications.show({
        color: 'green',
        message: 'Producto agregado a la canasta correctamente.',
      });

      navigate(`/comercios/${comercioId}`);
    } catch (err) {
      notifications.show({
        color: 'red',
        message:
          err instanceof ApiError
            ? err.message
            : 'No pudimos agregar el producto a la canasta.',
      });

      if (
        err instanceof ApiError &&
        (err.status === 400 || err.status === 410)
      ) {
        navigate(`/comercios/${comercioId}`);
      }
    } finally {
      setAgregando(false);
    }
  }

  if (cargando) {
    return (
      <main className="comercio-page detalle-oferta">
        <div className="tienda-cargando">
          <Loader color="brand" />
        </div>
      </main>
    );
  }

  if (error || !oferta) {
    return (
      <main className="comercio-page detalle-oferta">
        <div className="card">
          <div className="panel panel--bad">{error}</div>

          <Button
            fullWidth
            mt="md"
            onClick={() => {
              setCargando(true);
              setRecargar((actual) => actual + 1);
            }}
          >
            Reintentar
          </Button>

          <Button
            fullWidth
            mt="sm"
            variant="default"
            onClick={() =>
              navigate(
                comercioId
                  ? `/comercios/${comercioId}`
                  : '/perfil',
              )
            }
          >
            Volver al catálogo
          </Button>
        </div>
      </main>
    );
  }

  const imagen = resolverImagen(oferta.producto.imagen);
  const hayStock = oferta.producto.stock > 0;
  const cantidadMaxima = Math.max(oferta.producto.stock, 1);

  return (
    <main className="comercio-page detalle-oferta">
      <button
        type="button"
        className="chip"
        onClick={() => navigate(-1)}
      >
        ← Volver
      </button>

      <section className="card detalle-oferta__contenedor">
        <div className="detalle-oferta__imagen">
          {imagen ? (
            <img src={imagen} alt={oferta.producto.titulo} />
          ) : (
            <span>Sin imagen disponible</span>
          )}

          {descuento > 0 && (
            <span className="tienda-producto__descuento">
              -{descuento}%
            </span>
          )}
        </div>

        <div className="detalle-oferta__contenido">
          <span className="badge badge--blue">
            {oferta.producto.categoria.nombre}
          </span>

          <h1>{oferta.producto.titulo}</h1>

          <p className="detalle-oferta__descripcion">
            {oferta.producto.descripcion}
          </p>

          <div className="detalle-oferta__precios">
            {descuento > 0 && (
              <span className="tienda-producto__lista">
                {moneda.format(numero(oferta.producto.precioLista))}
              </span>
            )}

            <strong>
              {moneda.format(numero(oferta.producto.precioPublico))}
            </strong>
          </div>

          <div className="detalle-oferta__ahorro">
            Ahorrás {moneda.format(ahorro)} ({descuento}%)
          </div>

          <dl className="detalle-oferta__datos">
            <div>
              <dt>Vencimiento</dt>
              <dd>{fechaExacta(oferta.producto.fechaVencimiento)}</dd>
            </div>

            <div>
              <dt>Disponibilidad</dt>
              <dd>
                {hayStock
                  ? `${oferta.producto.stock} unidades`
                  : 'Sin stock'}
              </dd>
            </div>

            <div>
              <dt>Comercio</dt>
              <dd>{oferta.comercio.nombreFantasia}</dd>
            </div>
          </dl>

          {hayStock && (
            <div className="detalle-oferta__cantidad">
              <span className="detalle-oferta__cantidad-label">
                Cantidad
              </span>

              <div className="detalle-oferta__cantidad-control">
                <button
                  type="button"
                  className="chip"
                  aria-label="Disminuir cantidad"
                  disabled={cantidad <= 1 || agregando}
                  onClick={() =>
                    setCantidad((actual) => Math.max(1, actual - 1))
                  }
                >
                  −
                </button>

                <strong aria-live="polite">{cantidad}</strong>

                <button
                  type="button"
                  className="chip"
                  aria-label="Aumentar cantidad"
                  disabled={
                    cantidad >= cantidadMaxima || agregando
                  }
                  onClick={() =>
                    setCantidad((actual) =>
                      Math.min(cantidadMaxima, actual + 1),
                    )
                  }
                >
                  +
                </button>
              </div>

              <span className="detalle-oferta__cantidad-ayuda">
                Máximo disponible: {oferta.producto.stock}
              </span>
            </div>
          )}

          {hayStock && (
            <div className="detalle-oferta__total">
              Total seleccionado:{' '}
              <strong>{moneda.format(subtotalSeleccionado)}</strong>
            </div>
          )}

          <div className="detalle-oferta__acciones">
            <Button
              onClick={() => void agregarACanasta()}
              loading={agregando}
              disabled={!hayStock}
            >
              {hayStock
                ? 'Agregar a la canasta'
                : 'Producto sin stock'}
            </Button>

            <Button
              onClick={() =>
                navigate(`/comercios/${oferta.comercio.id}`)
              }
              variant="default"
            >
              Ver Tienda Completa
            </Button>

            <Button
              onClick={() =>
                navigate(`/canastas/${oferta.comercio.id}`)
              }
              variant="default"
            >
              Ver canasta
            </Button>
          </div>
        </div>
      </section>

      <section className="card detalle-oferta__ubicacion">
        <h2>Ubicación del comercio</h2>

        <p className="muted">
          {oferta.comercio.calle} {oferta.comercio.numero},{' '}
          {oferta.comercio.localidad}, {oferta.comercio.provincia}
        </p>

        {distancia !== null ? (
          <p className="detalle-oferta__distancia">
            Distancia aproximada: {distancia.toFixed(1)} km
          </p>
        ) : (
          <p className="muted">
            Activá la ubicación del dispositivo para calcular la distancia.
          </p>
        )}

        <MapaComercio
          latitud={oferta.comercio.latitud}
          longitud={oferta.comercio.longitud}
        />
      </section>
    </main>
  );
}
