import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Loader, Modal, Select, TextInput } from '@mantine/core';
import { api, direccionesApi, type Direccion } from '../api';
import { useAuth } from '../auth/contexto';
import { resolverImagen } from './api';
import { EncabezadoCliente } from './EncabezadoCliente';
import { obtenerMensajeErrorCatalogo } from './catalogo-errores';
import type { OfertaMapa } from './mapaCatalogo';
import './explorar.css';

interface Categoria {
  id: string;
  nombre: string;
  slug: string;
  subcategorias: Categoria[];
}

interface Producto extends OfertaMapa {
  descripcion: string;
  imagen: string;
  precioLista: number | string;
  fechaVencimiento: string;
  categoria: { nombre: string; slug: string };
  distanciaKm: number | null;
  comercio: OfertaMapa['comercio'] & { localidad: string; logoUrl: string };
}

interface Comercio {
  id: string;
  nombreFantasia: string;
  descripcion: string | null;
  logoUrl: string;
  localidad: string;
  abierto: boolean;
}

interface Filtros {
  categoriaId: string;
  precioMin: string;
  precioMax: string;
  radioKm: string;
  soloAbiertos: boolean;
}

const filtrosVacios: Filtros = {
  categoriaId: '',
  precioMin: '',
  precioMax: '',
  radioKm: '',
  soloAbiertos: false,
};
const moneda = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});
const BUSQUEDA_VACIA = 'Por favor, ingresa una palabra clave para buscar';
const SIN_RESULTADOS =
  'No encontramos resultados coincidentes. Intentá buscando por categoría o revisá la ortografía';
const SIN_OFERTAS_CATEGORIA =
  'Actualmente no hay ofertas disponibles en esta categoría. Explorá otros rubros cercanos';
const SIN_OFERTAS_FILTRADAS =
  'No hay ofertas que coincidan con todos los filtros aplicados';
const MapaExploracion = lazy(() =>
  import('./MapaExploracion').then((modulo) => ({
    default: modulo.MapaExploracion,
  })),
);

function formatearDistancia(distanciaKm: number | null): string | null {
  if (distanciaKm === null) return null;
  if (distanciaKm < 1) return `${Math.round(distanciaKm * 1000)} m`;
  return `${distanciaKm.toFixed(1)} km`;
}

export function ExplorarPage() {
  const { token } = useAuth();
  const [params, setParams] = useSearchParams();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [direccion, setDireccion] = useState<Direccion | null>(null);
  const [busqueda, setBusqueda] = useState(params.get('q') ?? '');
  const [avisoBusqueda, setAvisoBusqueda] = useState('');
  const [filtros, setFiltros] = useState<Filtros>(filtrosVacios);
  const [temporales, setTemporales] = useState<Filtros>(filtrosVacios);
  const [modal, setModal] = useState(false);
  const [pestana, setPestana] = useState<'productos' | 'comercios'>('productos');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  const query = params.get('q')?.trim() ?? '';

  useEffect(() => {
    let activo = true;
    void Promise.all([
      api<Categoria[]>('/categorias'),
      token ? direccionesApi.listar(token) : Promise.resolve([] as Direccion[]),
    ])
      .then(([cats, direcciones]) => {
        if (!activo) return;
        setCategorias(cats);
        setDireccion(
          direcciones.find((item) => item.esPredeterminada) ?? null,
        );
      })
      .catch((error: unknown) => {
        if (activo) setError(obtenerMensajeErrorCatalogo(error));
      });
    return () => {
      activo = false;
    };
  }, [token, intento]);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    const qs = new URLSearchParams();
    if (query) qs.set('q', query);
    if (filtros.categoriaId) qs.set('categoriaId', filtros.categoriaId);
    if (filtros.precioMin) qs.set('precioMin', filtros.precioMin);
    if (filtros.precioMax) qs.set('precioMax', filtros.precioMax);
    if (filtros.soloAbiertos) qs.set('abierto', 'true');
    if (direccion) {
      qs.set('latitud', String(direccion.latitud));
      qs.set('longitud', String(direccion.longitud));
      if (filtros.radioKm) qs.set('radioKm', filtros.radioKm);
    }
    const comercioQs = new URLSearchParams();
    if (query) comercioQs.set('q', query);

    Promise.all([
      api<Producto[]>(`/catalogo?${qs}`),
      query
        ? api<Comercio[]>(`/catalogo/comercios?${comercioQs}`)
        : Promise.resolve([] as Comercio[]),
    ])
      .then(([items, locales]) => {
        if (!activo) return;
        setProductos(items);
        setComercios(locales);
        setError('');
      })
      .catch((error: unknown) => {
        if (activo) setError(obtenerMensajeErrorCatalogo(error));
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [query, filtros, direccion, intento]);

  const ofertas = useMemo(
    () =>
      productos.map((producto) => ({
        ...producto,
        descuento: producto.precioLista
          ? Math.max(
              0,
              Math.round(
                (1 -
                  Number(producto.precioPublico) /
                    Number(producto.precioLista)) *
                  100,
              ),
            )
          : 0,
      })),
    [productos],
  );
  const filtrosAvanzadosActivos = Boolean(
    filtros.precioMin ||
      filtros.precioMax ||
      filtros.radioKm ||
      filtros.soloAbiertos,
  );
  const direccionLabel = direccion
    ? `${direccion.localidad}${direccion.etiqueta ? ` · ${direccion.etiqueta}` : ''}`
    : 'Agregá una dirección';

  function buscar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const texto = busqueda.trim();
    if (!texto) {
      setAvisoBusqueda(BUSQUEDA_VACIA);
      return;
    }
    setAvisoBusqueda('');
    setPestana('productos');
    setParams({ q: texto });
  }

  function reintentar() {
    setError('');
    setIntento((valor) => valor + 1);
  }

  function limpiarFiltros() {
    setFiltros(filtrosVacios);
    setTemporales(filtrosVacios);
  }

  let textoSinResultados = 'No hay ofertas disponibles en este momento.';
  if (filtrosAvanzadosActivos) textoSinResultados = SIN_OFERTAS_FILTRADAS;
  else if (query) textoSinResultados = SIN_RESULTADOS;
  else if (filtros.categoriaId) textoSinResultados = SIN_OFERTAS_CATEGORIA;

  return (
    <>
    <EncabezadoCliente
      busqueda={busqueda}
      direccionLabel={direccionLabel}
      placeholder="Buscar productos o comercios"
      disabledBuscar={!busqueda.trim()}
      onCambioBusqueda={(valor) => {
        setBusqueda(valor);
        if (valor.trim()) setAvisoBusqueda('');
      }}
      onBuscar={buscar}
    />
    <main className="explorar">
      <header className="explorar__hero">
        <p className="explorar__eyebrow">MENORCOST · OFERTAS CERCA TUYO</p>
        <h1>Encontrá algo bueno</h1>
        <p>Explorá productos con descuento en comercios de tu zona.</p>
        <p className="explorar__direccion">
          {direccion
            ? `Cerca de ${direccion.etiqueta} · ${direccion.localidad}`
            : 'Agregá una dirección predeterminada en tu perfil para ver ofertas cercanas.'}
        </p>
        {avisoBusqueda && <p role="alert">{avisoBusqueda}</p>}
      </header>

      <section className="explorar__section">
        <div className="explorar__heading">
          <div>
            <h2>Categorías</h2>
            <p>Elegí una categoría para explorar</p>
          </div>
        </div>
        <div className="explorar__categorias">
          <button
            className={!filtros.categoriaId ? 'is-active' : ''}
            onClick={() => setFiltros({ ...filtros, categoriaId: '' })}
          >
            Todas
          </button>
          {categorias.map((categoria) => (
            <button
              key={categoria.id}
              className={filtros.categoriaId === categoria.id ? 'is-active' : ''}
              onClick={() =>
                setFiltros({
                  ...filtros,
                  categoriaId:
                    filtros.categoriaId === categoria.id ? '' : categoria.id,
                })
              }
            >
              {categoria.nombre}
            </button>
          ))}
        </div>
      </section>

      <section className="explorar__section">
        <div className="explorar__heading">
          <div>
            <h2>{query ? `Resultados para “${query}”` : 'Ofertas para vos'}</h2>
            <p>Productos activos en comercios habilitados</p>
          </div>
          <Button
            variant="default"
            onClick={() => {
              setTemporales(filtros);
              setModal(true);
            }}
          >
            Filtros
          </Button>
        </div>
        {query && (
          <div className="explorar__tabs">
            <button
              className={pestana === 'productos' ? 'is-active' : ''}
              onClick={() => setPestana('productos')}
            >
              Productos coincidentes ({productos.length})
            </button>
            <button
              className={pestana === 'comercios' ? 'is-active' : ''}
              onClick={() => setPestana('comercios')}
            >
              Comercios coincidentes ({comercios.length})
            </button>
          </div>
        )}

        {error ? (
          <div className="explorar__empty" role="alert">
            <p>{error}</p>
            <Button variant="default" onClick={reintentar}>
              Reintentar
            </Button>
          </div>
        ) : cargando ? (
          <div className="explorar__loading">
            <Loader />
          </div>
        ) : pestana === 'productos' ? (
          ofertas.length ? (
            <>
              {direccion && (
                <section className="explorar__map-section">
                  <h2>Ofertas y comercios cercanos</h2>
                  <Suspense fallback={<div className="explorar__map-loading">Cargando mapa…</div>}>
                    <MapaExploracion
                      ofertas={ofertas}
                      latitudOrigen={Number(direccion.latitud)}
                      longitudOrigen={Number(direccion.longitud)}
                    />
                  </Suspense>
                </section>
              )}
              <div className="explorar__grid">
                {ofertas.map((producto) => {
                  const distancia = formatearDistancia(producto.distanciaKm);
                  return (
                    <article className="explorar__card" key={producto.id}>
                      <Link
                        to={`/comercios/${producto.comercio.id}/productos/${producto.id}`}
                      >
                        <img src={resolverImagen(producto.imagen) ?? ''} alt="" />
                        <div className="explorar__cardbody">
                          {producto.descuento > 0 && (
                            <span className="explorar__badge">
                              -{producto.descuento}%
                            </span>
                          )}
                          <span className="explorar__category">
                            {producto.categoria.nombre}
                          </span>
                          <h3>{producto.titulo}</h3>
                          <p className="explorar__merchant">
                            {producto.comercio.nombreFantasia} ·{' '}
                            {producto.comercio.localidad}
                          </p>
                          <div className="explorar__prices">
                            <s>{moneda.format(Number(producto.precioLista))}</s>
                            <strong>
                              {moneda.format(Number(producto.precioPublico))}
                            </strong>
                          </div>
                          <small>
                            Vence{' '}
                            {new Date(
                              `${producto.fechaVencimiento}T00:00:00`,
                            ).toLocaleDateString('es-AR')}
                            {distancia ? ` · ${distancia}` : ''}
                          </small>
                        </div>
                      </Link>
                    </article>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="explorar__empty">
              <p>{textoSinResultados}</p>
              {filtrosAvanzadosActivos && (
                <Button variant="default" onClick={limpiarFiltros}>
                  Limpiar filtros
                </Button>
              )}
            </div>
          )
        ) : comercios.length ? (
          <div className="explorar__comercios">
            {comercios.map((comercio) => (
              <Link
                className="explorar__comercio"
                key={comercio.id}
                to={`/comercios/${comercio.id}`}
              >
                <img src={resolverImagen(comercio.logoUrl) ?? ''} alt="" />
                <div>
                  <h3>{comercio.nombreFantasia}</h3>
                  <p>
                    {comercio.localidad} ·{' '}
                    {comercio.abierto ? 'Abierto' : 'Cerrado'}
                  </p>
                  <small>{comercio.descripcion}</small>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="explorar__empty">{SIN_RESULTADOS}</p>
        )}
      </section>

      <Modal
        opened={modal}
        onClose={() => setModal(false)}
        title="Filtrar ofertas"
        centered
      >
        <div className="explorar__filter">
          <Select
            label="Categoría"
            clearable
            data={categorias.map((categoria) => ({
              value: categoria.id,
              label: categoria.nombre,
            }))}
            value={temporales.categoriaId || null}
            onChange={(value) =>
              setTemporales({ ...temporales, categoriaId: value ?? '' })
            }
          />
          <div className="explorar__pricesinput">
            <TextInput
              label="Precio mínimo"
              type="number"
              min="0"
              value={temporales.precioMin}
              onChange={(event) =>
                setTemporales({
                  ...temporales,
                  precioMin: event.currentTarget.value,
                })
              }
            />
            <TextInput
              label="Precio máximo"
              type="number"
              min="0"
              value={temporales.precioMax}
              onChange={(event) =>
                setTemporales({
                  ...temporales,
                  precioMax: event.currentTarget.value,
                })
              }
            />
          </div>
          <Select
            label="Distancia máxima"
            disabled={!direccion}
            clearable
            data={['5', '10', '25', '50'].map((value) => ({
              value,
              label: `${value} km`,
            }))}
            value={temporales.radioKm || null}
            onChange={(value) =>
              setTemporales({ ...temporales, radioKm: value ?? '' })
            }
          />
          <label className="explorar__check">
            <input
              type="checkbox"
              checked={temporales.soloAbiertos}
              onChange={(event) =>
                setTemporales({
                  ...temporales,
                  soloAbiertos: event.currentTarget.checked,
                })
              }
            />
            Solo comercios abiertos ahora
          </label>
          <div className="explorar__actions">
            <Button variant="default" onClick={() => setModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setFiltros(temporales);
                setModal(false);
              }}
            >
              Aplicar filtros
            </Button>
          </div>
        </div>
      </Modal>
    </main>
    </>
  );
}
