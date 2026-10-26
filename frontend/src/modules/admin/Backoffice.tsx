import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Select, TextInput } from '@mantine/core';
import { adminApi, type AdminKpis } from '../../api';
import { useAuth } from '../../auth/contexto';
import { Chip } from '../../components/ui/Chip';
import type { AdminOutletContext } from './adminContext';
import { ESTADO_ABIERTAS, esSesionVencida } from './adminFormat';

type TabId = 'altas' | 'bajas' | 'denuncias';

interface TabDef {
  id: TabId;
  label: string;
  href: string;
  kpi: keyof AdminKpis;
  placeholder: string;
  /** Cola de trabajo que se muestra al entrar: lo pendiente/abierto. */
  defaultEstado: string;
  estados: Array<{ value: string; label: string }>;
}

const TODOS = { value: 'todos', label: 'Estado: todos' };

const TABS: TabDef[] = [
  {
    id: 'altas',
    label: 'Solicitudes de Alta',
    href: '/admin/altas',
    kpi: 'altasPendientes',
    placeholder: 'Buscar por nombre, DNI o correo',
    defaultEstado: 'PENDIENTE_VERIFICACION',
    estados: [
      TODOS,
      { value: 'PENDIENTE_VERIFICACION', label: 'Pendientes de verificación' },
      { value: 'HABILITADO', label: 'Habilitados' },
      { value: 'DOCUMENTACION_RECHAZADA', label: 'Documentación rechazada' },
    ],
  },
  {
    id: 'bajas',
    label: 'Bajas de cuentas',
    href: '/admin/bajas',
    kpi: 'bajasSolicitadas',
    placeholder: 'Buscar por nombre, DNI o correo',
    defaultEstado: 'PENDIENTE',
    estados: [
      TODOS,
      { value: 'PENDIENTE', label: 'Pendientes' },
      { value: 'APROBADA', label: 'Aprobadas' },
      { value: 'RECHAZADA', label: 'Rechazadas' },
    ],
  },
  {
    id: 'denuncias',
    label: 'Denuncias y moderación',
    href: '/admin/denuncias',
    kpi: 'denunciasAbiertas',
    placeholder: 'Buscar por motivo o denunciado',
    defaultEstado: ESTADO_ABIERTAS,
    estados: [
      TODOS,
      { value: ESTADO_ABIERTAS, label: 'Abiertas (en revisión o investigación)' },
      { value: 'PENDIENTE_REVISION', label: 'En revisión' },
      { value: 'BAJO_INVESTIGACION', label: 'Bajo investigación' },
      { value: 'RESUELTO', label: 'Sancionadas' },
      { value: 'DESESTIMADO', label: 'Desestimadas' },
    ],
  },
];

const KPI_CARDS: Array<{ key: keyof AdminKpis; label: string; tone: string }> = [
  { key: 'altasPendientes', label: 'Altas pendientes', tone: 'ink' },
  { key: 'altasAprobadas30Dias', label: 'Altas aprobadas (30 días)', tone: 'ok' },
  { key: 'bajasSolicitadas', label: 'Bajas solicitadas', tone: 'warn' },
  { key: 'denunciasAbiertas', label: 'Denuncias abiertas', tone: 'bad' },
];

export function Backoffice() {
  const { token, cerrarSesion } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const tabActiva = useMemo(
    () => TABS.find((t) => location.pathname.startsWith(t.href)) ?? TABS[0],
    [location.pathname],
  );

  const [kpis, setKpis] = useState<AdminKpis | null>(null);
  const [kpisError, setKpisError] = useState(false);
  // Filtros por pestaña: cada una tiene sus propios estados válidos.
  const [busquedas, setBusquedas] = useState<Record<TabId, string>>({
    altas: '',
    bajas: '',
    denuncias: '',
  });
  const [estados, setEstados] = useState<Record<TabId, string>>({
    altas: TABS[0].defaultEstado,
    bajas: TABS[1].defaultEstado,
    denuncias: TABS[2].defaultEstado,
  });
  const [searchDebounced, setSearchDebounced] = useState<Record<TabId, string>>({
    altas: '',
    bajas: '',
    denuncias: '',
  });

  const busqueda = busquedas[tabActiva.id];
  const estado = estados[tabActiva.id];
  const search = searchDebounced[tabActiva.id];

  const refrescarKpis = useCallback(() => {
    if (!token) return;
    adminApi
      .kpis(token)
      .then((data) => {
        setKpis(data);
        setKpisError(false);
      })
      .catch((err) => {
        if (esSesionVencida(err)) cerrarSesion();
        else setKpisError(true);
      });
  }, [token, cerrarSesion]);

  useEffect(() => {
    refrescarKpis();
  }, [refrescarKpis]);

  // Debounce de la búsqueda para no consultar en cada tecla.
  useEffect(() => {
    const id = tabActiva.id;
    const t = window.setTimeout(
      () => setSearchDebounced((prev) => ({ ...prev, [id]: busqueda.trim() })),
      300,
    );
    return () => window.clearTimeout(t);
  }, [busqueda, tabActiva.id]);

  const contexto: AdminOutletContext = { search, estado, refrescarKpis };

  return (
    <main className="admin-wrap">
      <header className="admin-head">
        <h1>Backoffice · Administración</h1>
        <p className="admin-head__sub">Moderación de altas, bajas y denuncias de la plataforma</p>
      </header>

      <section className="admin-kpis" aria-label="Indicadores">
        {KPI_CARDS.map((k) => (
          <div className="admin-kpi" key={k.key}>
            <div className={`admin-kpi__num admin-kpi__num--${k.tone}`}>
              {kpis ? kpis[k.key] : '–'}
            </div>
            <div className="admin-kpi__label">{k.label}</div>
          </div>
        ))}
      </section>
      {kpisError && (
        <p className="help admin-kpis__error">
          No pudimos actualizar los indicadores.{' '}
          <button type="button" className="link-button" onClick={refrescarKpis}>
            Reintentar
          </button>
        </p>
      )}

      <nav className="admin-tabs" aria-label="Secciones del backoffice">
        {TABS.map((tab) => {
          const activa = tab.id === tabActiva.id;
          return (
            <Chip
              key={tab.id}
              dark
              active={activa}
              current={activa}
              onClick={() => navigate(tab.href)}
            >
              {tab.label}
              <span className="admin-count">{kpis ? kpis[tab.kpi] : '–'}</span>
            </Chip>
          );
        })}
      </nav>

      <div className="admin-filters">
        <TextInput
          className="admin-filters__search"
          placeholder={tabActiva.placeholder}
          aria-label="Buscar"
          value={busqueda}
          onChange={(e) => {
            const v = e.currentTarget.value;
            setBusquedas((prev) => ({ ...prev, [tabActiva.id]: v }));
          }}
        />
        <Select
          className="admin-filters__estado"
          aria-label="Filtrar por estado"
          data={tabActiva.estados}
          value={estado}
          onChange={(v) => setEstados((prev) => ({ ...prev, [tabActiva.id]: v ?? 'todos' }))}
          allowDeselect={false}
        />
      </div>

      <Outlet context={contexto} />
    </main>
  );
}