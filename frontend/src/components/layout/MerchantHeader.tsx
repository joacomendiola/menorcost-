import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Switch } from '@mantine/core';
import { Logo } from '../Logo';
import { Chip } from '../ui/Chip';
import { Badge } from '../ui/Badge';
import { useAuth } from '../../auth/contexto';
import {NotificationsBell} from "./NotificacionCampana";

const TABS = [
  { id: 'ofertas', label: 'Ofertas', href: '/ofertas/mias' },
  { id: 'mi-local', label: 'Mi local', href: '/comercios/perfil' },
  { id: 'horarios', label: 'Horarios', href: '/comercios/horarios' },
  {
    id: 'reputacion',
    label: 'Reputación',
    href: '/panel/reputacion',
  },
] as const;

export function MerchantHeader() {
  const { usuario, cargando } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(true); // En producción vendría del backend

  if (cargando || !usuario) return null;

  const currentTab =
    TABS.find((tab) => location.pathname === tab.href)?.id ??
    (location.pathname === '/panel' ? 'reputacion' : '');

  return (
    <header className="merchant-header">
      <div className="merchant-header__left">
        <Link to="/ofertas/mias" aria-label="Ir a mis ofertas">
          <Logo />
        </Link>
      </div>

      <nav className="merchant-header__tabs" aria-label="Secciones del comercio">
        {TABS.map((tab) => (
          <Chip
            key={tab.id}
            active={currentTab === tab.id}
            current={currentTab === tab.id}
            onClick={() => navigate(tab.href)}
          >
            {tab.label}
          </Chip>
        ))}
      </nav>

      <div className="merchant-header__right">

        <NotificationsBell />

        <Badge tone={abierto ? 'ok' : 'bad'}>
          {abierto ? 'Local abierto' : 'Local cerrado'}
        </Badge>
        <Switch
          checked={abierto}
          onChange={e => setAbierto(e.currentTarget.checked)}
          size="md"
          color="green"
          radius="xl"
          styles={{ track: { width: 42, height: 24 }, thumb: { width: 18, height: 18 } }}
          aria-label={abierto ? 'Cerrar local' : 'Abrir local'}
        />
        <Link to="/perfil" className="pill">
          <span aria-hidden="true">👤</span>
          {usuario.nombre}
          <span aria-hidden="true">⌄</span>
        </Link>
      </div>
    </header>
  );
}