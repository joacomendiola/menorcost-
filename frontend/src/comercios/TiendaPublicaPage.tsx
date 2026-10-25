import { Button, Loader, Select } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api';
import { MapaComercio } from './MapaComercio';
import {
  comerciosApi,
  resolverImagen,
  type ProductoTienda,
  type TiendaPublica,
} from './api';
import { DIAS, formatearRango, ORDEN_DIAS } from './configuracion';
import './comercios.css';

type OrdenProductos = 'relevancia' | 'precio' | 'descuento';

const moneda = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
});

const OPCIONES_ORDEN = [
  { value: 'relevancia', label: 'Relevancia' },
  { value: 'precio', label: 'Menor precio' },
  { value: 'descuento', label: 'Mayor descuento' },
];

function numero(valor: string | number): number {
  return Number(valor);
}

function descuento(producto: ProductoTienda): number {
  const lista = numero(producto.precioLista);
  const menorcost = numero(producto.precioMenorcost);

  if (lista <= 0 || menorcost >= lista) return 0;

  return Math.round((1 - menorcost / lista) * 100);
}

function fechaCorta(fecha: string): string {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function mensajeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.status === 404
      ? 'Esta tienda no está disponible o todavía no fue habilitada.'
      : error.message;
  }

  return 'No pudimos cargar la tienda.';
}

export function TiendaPublicaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tienda, setTienda] = useState<TiendaPublica | null>(null);
  const [cargando, setCargando] = useState(Boolean(id));
  const [error, setError] = useState(
    id ? '' : 'La tienda solicitada no existe.',
  );
  const [orden, setOrden] = useState<OrdenProductos>('relevancia');
  const [recargar, setRecargar] = useState(0);

  useEffect(() => {
    if (!id) return;

    const comercioId = id;
    let activo = true;

    async function cargar() {
      try {
        const data = await comerciosApi.tienda(comercioId);
        if (!activo) return;
        setTienda(data);
        setError('');
      } catch (err) {
        if (activo) setError(mensajeError(err));
      } finally {
        if (activo) setCargando(false);
      }
    }

    void cargar();

    return () => {
      activo = false;
    };
  }, [id, recargar]);

  const productos = useMemo(() => {
    if (!tienda) return [];

    return [...tienda.productos].sort((a, b) => {
      if (orden === 'precio') {
        return numero(a.precioMenorcost) - numero(b.precioMenorcost);
      }

      if (orden === 'descuento') {
        return descuento(b) - descuento(a);
      }

      return 0;
    });
  }, [tienda, orden]);

  if (cargando) {
    return (
      <main className="comercio-page tienda-publica">
        <div className="tienda-cargando">
          <Loader color="brand" />
        </div>
      </main>
    );
  }

  if (error || !tienda) {
    return (
      <main className="comercio-page tienda-publica">
        <div className="card">
          <div className="panel panel--bad">{error}</div>
          <Button
            fullWidth
            mt="md"
            variant="default"
            onClick={() => {
              setCargando(true);
              setRecargar((prev) => prev + 1);
            }}
          >
            Reintentar
          </Button>
          <Button fullWidth mt="sm" onClick={() => navigate('/perfil')}>
            Volver al inicio
          </Button>
        </div>
      </main>
    );
  }

  const portada = resolverImagen(tienda.portadaUrl);
  const logo = resolverImagen(tienda.logoUrl);
  const horariosPorDia = ORDEN_DIAS.map((dia) => ({
    dia,
    horarios: tienda.horarios.filter((horario) => horario.diaSemana === dia),
  })).filter(({ horarios }) => horarios.length > 0);

  return (
    <main className="comercio-page tienda-publica">
      <button type="button" className="chip" onClick={() => navigate(-1)}>
        ← Volver
      </button>

      <section className="card tienda-cabecera">
        <div
          className="tienda-portada"
          style={portada ? { backgroundImage: `url(${portada})` } : undefined}
        />

        <div className="tienda-cabecera__cuerpo">
          {logo ? (
            <img
              className="tienda-logo"
              src={logo}
              alt={`Logo de ${tienda.nombreFantasia}`}
            />
          ) : (
            <div className="tienda-logo" aria-hidden="true">
              {tienda.nombreFantasia.slice(0, 2).toUpperCase()}
            </div>
          )}

          <div className="tienda-cabecera__texto">
            <div className="tienda-cabecera__titulo">
              <h1>{tienda.nombreFantasia}</h1>
              <span
                className={`comercio-estado ${
                  tienda.abierto
                    ? 'comercio-estado--ok'
                    : 'comercio-estado--malo'
                }`}
              >
                {tienda.abierto ? 'Abierto' : 'Cerrado'}
              </span>
            </div>

            <p className="muted">
              {tienda.calle} {tienda.numero}
              {tienda.piso ? `, ${tienda.piso}` : ''}, {tienda.localidad},{' '}
              {tienda.provincia}
            </p>

            <div className="tienda-reputacion">
              {tienda.reputacion === null
                ? 'Reputación: sin calificaciones todavía'
                : `Reputación: ${tienda.reputacion.toFixed(1)}`}
            </div>

            {tienda.descripcion && (
              <p className="tienda-descripcion">{tienda.descripcion}</p>
            )}
          </div>
        </div>
      </section>

      <div className="tienda-layout">
        <section className="card tienda-catalogo">
          <div className="tienda-catalogo__cabecera">
            <div>
              <h2>Ofertas del comercio</h2>
              <p className="muted">
                {productos.length === 0
                  ? 'Sin publicaciones activas'
                  : `${productos.length} publicación${
                      productos.length === 1 ? '' : 'es'
                    } disponible${productos.length === 1 ? '' : 's'}`}
              </p>
            </div>

            {productos.length > 1 && (
              <Select
                aria-label="Ordenar ofertas"
                value={orden}
                onChange={(valor) =>
                  setOrden((valor as OrdenProductos) ?? 'relevancia')
                }
                data={OPCIONES_ORDEN}
                allowDeselect={false}
                w={210}
              />
            )}
          </div>

          {productos.length === 0 ? (
            <div className="tienda-vacia">
              <p>Este comercio no posee ofertas publicadas actualmente.</p>
            </div>
          ) : (
            <div className="tienda-productos">
              {productos.map((producto) => {
                const imagen = resolverImagen(producto.imagen);
                const descuentoProducto = descuento(producto);

                return (
                  <article className="tienda-producto" key={producto.id}>
                    <div className="tienda-producto__imagen">
                      {imagen ? (
                        <img src={imagen} alt={producto.titulo} />
                      ) : (
                        <span>Sin imagen</span>
                      )}
                      {descuentoProducto > 0 && (
                        <span className="tienda-producto__descuento">
                          -{descuentoProducto}%
                        </span>
                      )}
                    </div>

                    <div className="tienda-producto__cuerpo">
                      <span className="badge badge--blue">
                        {producto.categoria.nombre}
                      </span>
                      <h3>{producto.titulo}</h3>
                      <p className="tienda-producto__descripcion">
                        {producto.descripcion}
                      </p>

                      <div className="tienda-producto__precios">
                        {descuentoProducto > 0 && (
                          <span className="tienda-producto__lista">
                            {moneda.format(numero(producto.precioLista))}
                          </span>
                        )}
                        <strong>
                          {moneda.format(numero(producto.precioMenorcost))}
                        </strong>
                      </div>

                      <div className="tienda-producto__meta">
                        <span>Vence: {fechaCorta(producto.fechaVencimiento)}</span>
                        <span>
                          {producto.stock > 0
                            ? `${producto.stock} disponibles`
                            : 'Sin stock'}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="tienda-lateral">
          <section className="card">
            <h3>Horarios de atención</h3>
            {horariosPorDia.length === 0 ? (
              <p className="muted">El comercio todavía no informó horarios.</p>
            ) : (
              <div className="tienda-horarios">
                {horariosPorDia.map(({ dia, horarios }) => (
                  <div key={dia} className="comercio-preview__fila">
                    <span>{DIAS[dia]}</span>
                    <span>
                      {horarios
                        .map((horario) => formatearRango(horario))
                        .join(' · ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h3>Ubicación</h3>
            <p className="muted">
              {tienda.calle} {tienda.numero}, {tienda.localidad}
            </p>
            <div className="tienda-mapa">
              <MapaComercio
                latitud={numero(tienda.latitud)}
                longitud={numero(tienda.longitud)}
              />
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
