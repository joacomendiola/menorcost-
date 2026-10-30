import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Switch } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Logo } from '../Logo';
import { Chip } from '../ui/Chip';
import { Badge } from '../ui/Badge';
import { useAuth } from '../../auth/contexto';
import { comerciosApi } from '../../comercios/api';

const TABS = [
  { id: 'resumen', label: 'Resumen', href: '/panel' },
  { id: 'pedidos', label: 'Pedidos', href: '/panel/pedidos' },
  { id: 'productos', label: 'Productos', href: '/panel/productos' },
  { id: 'mi-local', label: 'Mi local', href: '/panel/mi-local' },
  { id: 'reputacion', label: 'Reputación', href: '/panel/reputacion' },
] as const;

export function MerchantHeader() {
  const { usuario, token, cargando } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState<boolean | null>(null);
  const [cambiandoApertura, setCambiandoApertura] = useState(false);

  useEffect(() => {
    if (!token || usuario?.rol !== 'COMERCIANTE') return;
    let activo = true;

    comerciosApi
      .mio(token)
      .then((comercio) => {
        if (activo) setAbierto(comercio?.abierto ?? null);
      })
      .catch(() => {
        if (activo) setAbierto(null);
      });

    return () => {
      activo = false;
    };
  }, [token, usuario?.rol]);

  async function alternarApertura(nuevo: boolean) {
    if (!token || cambiandoApertura) return;

    const anterior = abierto;
    setAbierto(nuevo);
    setCambiandoApertura(true);

    try {
      const resultado = await comerciosApi.cambiarApertura(token, nuevo);
      setAbierto(resultado.abierto);
      notifications.show({
        message: resultado.abierto
          ? 'Tu comercio figura abierto.'
          : 'Tu comercio figura cerrado.',
      });
    } catch {
      setAbierto(anterior);
      notifications.show({
        color: 'red',
        message: 'No pudimos cambiar el estado del local.',
      });
    } finally {
      setCambiandoApertura(false);
    }
  }

  if (cargando || !usuario) return null;

  const currentTab = TABS.find(t => location.pathname === t.href)?.id ?? 'resumen';

  return (
    <header className="merchant-header">
      <div className="merchant-header__left">
        <Link to="/panel" aria-label="Ir al panel de control">
          <Logo />
        </Link>
      </div>

      <nav className="merchant-header__tabs" aria-label="Secciones del panel">
        {TABS.map(tab => (
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
        <Badge tone={abierto === null ? 'neutro' : abierto ? 'ok' : 'bad'}>
          {abierto === null
            ? 'Local sin estado'
            : abierto
              ? 'Local abierto'
              : 'Local cerrado'}
        </Badge>
        <Switch
          checked={abierto ?? false}
          disabled={abierto === null || cambiandoApertura}
          onChange={e => void alternarApertura(e.currentTarget.checked)}
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