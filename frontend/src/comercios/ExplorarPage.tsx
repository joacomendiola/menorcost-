import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Loader, Modal, Select, TextInput } from '@mantine/core';
import { api, direccionesApi, type Direccion } from '../api';
import { useAuth } from '../auth/contexto';
import { resolverImagen } from './api';
import './explorar.css';

interface Categoria { id: string; nombre: string; slug: string; subcategorias: Categoria[] }
interface Producto { id: string; titulo: string; descripcion: string; imagen: string; precioLista: number | string; precioPublico: number | string; fechaVencimiento: string; categoria: { nombre: string; slug: string }; distanciaKm: number | null; comercio: { id: string; nombreFantasia: string; localidad: string; logoUrl: string; abierto: boolean } }
interface Comercio { id: string; nombreFantasia: string; descripcion: string | null; logoUrl: string; localidad: string; abierto: boolean }
interface Filtros { categoriaId: string; precioMin: string; precioMax: string; radioKm: string; soloAbiertos: boolean }
const vacios: Filtros = { categoriaId: '', precioMin: '', precioMax: '', radioKm: '', soloAbiertos: false };
const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

export function ExplorarPage() {
  const { token } = useAuth();
  const [params, setParams] = useSearchParams();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [direccion, setDireccion] = useState<Direccion | null>(null);
  const [busqueda, setBusqueda] = useState(params.get('q') ?? '');
  const [filtros, setFiltros] = useState<Filtros>(vacios);
  const [temporales, setTemporales] = useState<Filtros>(vacios);
  const [modal, setModal] = useState(false);
  const [pestana, setPestana] = useState<'productos' | 'comercios'>('productos');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const query = params.get('q')?.trim() ?? '';

  useEffect(() => {
    void Promise.all([api<Categoria[]>('/categorias'), token ? direccionesApi.listar(token) : Promise.resolve([] as Direccion[])])
      .then(([cats, direcciones]) => {
        setCategorias(cats.flatMap((cat) => cat.subcategorias.length ? cat.subcategorias : [cat]));
        setDireccion(direcciones.find((d) => d.esPredeterminada) ?? null);
      }).catch((e: unknown) => setError(e instanceof Error ? e.message : 'No pudimos cargar el catálogo.'));
  }, [token]);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    const qs = new URLSearchParams();
    if (query.length >= 2) qs.set('q', query);
    if (filtros.categoriaId) qs.set('categoriaId', filtros.categoriaId);
    if (filtros.precioMin) qs.set('precioMin', filtros.precioMin);
    if (filtros.precioMax) qs.set('precioMax', filtros.precioMax);
    if (filtros.soloAbiertos) qs.set('abierto', 'true');
    if (direccion) {
      qs.set('latitud', String(direccion.latitud)); qs.set('longitud', String(direccion.longitud));
      if (filtros.radioKm) qs.set('radioKm', filtros.radioKm);
    }
    const comercioQs = new URLSearchParams(); if (query.length >= 2) comercioQs.set('q', query);
    Promise.all([api<Producto[]>(`/catalogo?${qs}`), query.length >= 2 ? api<Comercio[]>(`/catalogo/comercios?${comercioQs}`) : Promise.resolve([] as Comercio[])])
      .then(([items, locals]) => { if (activo) { setProductos(items); setComercios(locals); setError(''); } })
      .catch((e: unknown) => { if (activo) setError(e instanceof Error ? e.message : 'No pudimos cargar los resultados.'); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [query, filtros, direccion]);

  const ofertas = useMemo(() => productos.map((p) => ({ ...p, descuento: p.precioLista ? Math.max(0, Math.round((1 - Number(p.precioPublico) / Number(p.precioLista)) * 100)) : 0 })), [productos]);
  function buscar(event: React.FormEvent) { event.preventDefault(); setParams(busqueda.trim() ? { q: busqueda.trim() } : {}); }

  return <main className="explorar">
    <header className="explorar__hero"><p className="explorar__eyebrow">MENORCOST · OFERTAS CERCA TUYO</p><h1>Encontrá algo bueno</h1><p>Explorá productos con descuento en comercios de tu zona.</p>
      <form className="explorar__search" onSubmit={buscar}><TextInput aria-label="Buscar productos o comercios" placeholder="¿Qué estás buscando?" value={busqueda} onChange={(e) => setBusqueda(e.currentTarget.value)} /><Button type="submit">Buscar</Button></form>
      <p className="explorar__direccion">{direccion ? `Cerca de ${direccion.etiqueta} · ${direccion.localidad}` : 'Agregá una dirección predeterminada en tu perfil para ver ofertas cercanas.'}</p>
    </header>
    <section className="explorar__section"><div className="explorar__heading"><div><h2>Categorías</h2><p>Elegí una categoría para explorar</p></div></div><div className="explorar__categorias"><button className={!filtros.categoriaId ? 'is-active' : ''} onClick={() => setFiltros({ ...filtros, categoriaId: '' })}>Todas</button>{categorias.map((c) => <button key={c.id} className={filtros.categoriaId === c.id ? 'is-active' : ''} onClick={() => setFiltros({ ...filtros, categoriaId: filtros.categoriaId === c.id ? '' : c.id })}>{c.nombre}</button>)}</div></section>
    <section className="explorar__section"><div className="explorar__heading"><div><h2>{query ? `Resultados para “${query}”` : 'Ofertas para vos'}</h2><p>Productos activos en comercios habilitados</p></div><Button variant="default" onClick={() => { setTemporales(filtros); setModal(true); }}>Filtros</Button></div>
      {query && <div className="explorar__tabs"><button className={pestana === 'productos' ? 'is-active' : ''} onClick={() => setPestana('productos')}>Productos ({productos.length})</button><button className={pestana === 'comercios' ? 'is-active' : ''} onClick={() => setPestana('comercios')}>Comercios ({comercios.length})</button></div>}
      {error && <p role="alert" className="explorar__empty">{error}</p>}{cargando ? <div className="explorar__loading"><Loader /></div> : pestana === 'productos' ? ofertas.length ? <div className="explorar__grid">{ofertas.map((p) => <article className="explorar__card" key={p.id}><Link to={`/comercios/${p.comercio.id}/productos/${p.id}`}><img src={resolverImagen(p.imagen) ?? ''} alt="" /><div className="explorar__cardbody">{p.descuento > 0 && <span className="explorar__badge">-{p.descuento}%</span>}<span className="explorar__category">{p.categoria.nombre}</span><h3>{p.titulo}</h3><p className="explorar__merchant">{p.comercio.nombreFantasia} · {p.comercio.localidad}</p><div className="explorar__prices"><s>{ars.format(Number(p.precioLista))}</s><strong>{ars.format(Number(p.precioPublico))}</strong></div><small>Vence {new Date(`${p.fechaVencimiento}T00:00:00`).toLocaleDateString('es-AR')}{p.distanciaKm !== null ? ` · ${p.distanciaKm.toFixed(1)} km` : ''}</small></div></Link></article>)}</div> : <p className="explorar__empty">No encontramos ofertas con estos criterios. Probá cambiar los filtros o buscar otra cosa.</p> : comercios.length ? <div className="explorar__comercios">{comercios.map((c) => <Link className="explorar__comercio" key={c.id} to={`/comercios/${c.id}`}><img src={resolverImagen(c.logoUrl) ?? ''} alt="" /><div><h3>{c.nombreFantasia}</h3><p>{c.localidad} · {c.abierto ? 'Abierto' : 'Cerrado'}</p><small>{c.descripcion}</small></div></Link>)}</div> : <p className="explorar__empty">No encontramos comercios con ese nombre.</p>}
    </section>
    <Modal opened={modal} onClose={() => setModal(false)} title="Filtrar ofertas" centered><div className="explorar__filter"><Select label="Categoría" clearable data={categorias.map((c) => ({ value: c.id, label: c.nombre }))} value={temporales.categoriaId || null} onChange={(v) => setTemporales({ ...temporales, categoriaId: v ?? '' })} /><div className="explorar__pricesinput"><TextInput label="Precio mínimo" type="number" min="0" value={temporales.precioMin} onChange={(e) => setTemporales({ ...temporales, precioMin: e.currentTarget.value })} /><TextInput label="Precio máximo" type="number" min="0" value={temporales.precioMax} onChange={(e) => setTemporales({ ...temporales, precioMax: e.currentTarget.value })} /></div><Select label="Distancia máxima" disabled={!direccion} clearable data={['5', '10', '25', '50'].map((v) => ({ value: v, label: `${v} km` }))} value={temporales.radioKm || null} onChange={(v) => setTemporales({ ...temporales, radioKm: v ?? '' })} /><label className="explorar__check"><input type="checkbox" checked={temporales.soloAbiertos} onChange={(e) => setTemporales({ ...temporales, soloAbiertos: e.currentTarget.checked })} /> Solo comercios abiertos</label><div className="explorar__actions"><Button variant="default" onClick={() => setModal(false)}>Cancelar</Button><Button onClick={() => { setFiltros(temporales); setModal(false); }}>Aplicar filtros</Button></div></div></Modal>
  </main>;
}
