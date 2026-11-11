import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ApiError, type EstadoUsuario } from '../api';
import { useAuth } from '../auth/contexto';
import { PageShell } from '../components/PageShell';
import { comerciosApi, type Comercio } from '../comercios/api';

const CORREO_SOPORTE = 'menorcost@gmail.com';

const DOCUMENTOS = [
  'Constancia de CUIT',
  'Razón social',
  'DNI del titular',
  'Habilitación comercial',
];

type EstadoVisible =
  | 'EN_REVISION'
  | 'RECHAZADO'
  | 'SUSPENDIDO'
  | 'HABILITADO';

function estadoVisible(
  estadoUsuario: EstadoUsuario,
  estadoComercio: Comercio['estado'] | null,
): EstadoVisible {
  if (
    estadoUsuario === 'DOCUMENTACION_RECHAZADA' ||
    estadoComercio === 'DOCUMENTACION_RECHAZADA'
  ) {
    return 'RECHAZADO';
  }

  if (estadoUsuario === 'SUSPENDIDO' || estadoComercio === 'SUSPENDIDO') {
    return 'SUSPENDIDO';
  }

  if (estadoUsuario === 'HABILITADO' && estadoComercio === 'HABILITADO') {
    return 'HABILITADO';
  }

  return 'EN_REVISION';
}

const TITULOS: Record<Exclude<EstadoVisible, 'HABILITADO'>, string> = {
  EN_REVISION: 'Tu comercio está en revisión',
  RECHAZADO: 'Tu comercio necesita correcciones',
  SUSPENDIDO: 'Tu comercio está suspendido',
};

const BADGES: Record<
  Exclude<EstadoVisible, 'HABILITADO'>,
  { etiqueta: string; clase: string }
> = {
  EN_REVISION: { etiqueta: 'PENDIENTE_VERIFICACION', clase: 'badge--pend' },
  RECHAZADO: { etiqueta: 'RECHAZADO', clase: 'badge--bad' },
  SUSPENDIDO: { etiqueta: 'SUSPENDIDO', clase: 'badge--bad' },
};

export function ComercioEstadoPage() {
  const navigate = useNavigate();
  const { usuario, token, cargando, cerrarSesion } = useAuth();
  const [comercio, setComercio] = useState<Comercio | null>(null);
  const [cargandoComercio, setCargandoComercio] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || usuario?.rol !== 'COMERCIANTE') return;

    let activo = true;

    comerciosApi
      .mio(token)
      .then((data) => {
        if (activo) setComercio(data);
      })
      .catch((err: unknown) => {
        if (!activo) return;
        setError(
          err instanceof ApiError
            ? err.message
            : 'No pudimos cargar el estado de tu comercio.',
        );
      })
      .finally(() => {
        if (activo) setCargandoComercio(false);
      });

    return () => {
      activo = false;
    };
  }, [token, usuario?.rol]);

  if (cargando) {
    return (
      <PageShell variant="profile">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader color="brand" />
        </div>
      </PageShell>
    );
  }

  if (!usuario || usuario.rol !== 'COMERCIANTE') {
    return <Navigate to="/perfil" replace />;
  }

  if (token && cargandoComercio) {
    return (
      <PageShell variant="profile">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader color="brand" />
        </div>
      </PageShell>
    );
  }

  const estado = estadoVisible(usuario.estado, comercio?.estado ?? null);

  if (estado === 'HABILITADO') {
    return <Navigate to="/panel" replace />;
  }

  const badge = BADGES[estado];
  const rechazado = estado === 'RECHAZADO';

  async function copiarCorreo() {
    try {
      await navigator.clipboard.writeText(CORREO_SOPORTE);
      notifications.show({ message: 'Correo de soporte copiado.' });
    } catch {
      notifications.show({
        color: 'red',
        message: `Copiá manualmente el correo: ${CORREO_SOPORTE}`,
      });
    }
  }

  function salir() {
    cerrarSesion();
    navigate('/login', { replace: true });
  }

  function corregir() {
    navigate(comercio ? '/comercios/perfil' : '/comercios/registro');
  }

  return (
    <PageShell variant="profile">
      <div className="card card--left" style={{ maxWidth: 640, margin: '0 auto' }}>
        <div className="row" style={{ alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{TITULOS[estado]}</h2>
          <span className={`badge ${badge.clase}`} style={{ marginLeft: 'auto' }}>
            {badge.etiqueta}
          </span>
        </div>

        <p className="muted">
          {rechazado
            ? 'Revisá la documentación observada y volvé a enviarla para que el equipo de soporte la valide.'
            : 'Estamos validando tu documentación. Mientras tanto no podés publicar ofertas ni recibir pedidos.'}
        </p>

        {rechazado && (
          <div className="panel panel--bad" style={{ marginBottom: 18 }}>
            La documentación fue observada. Corregí los datos de tu comercio y
            reenviá la solicitud. Si necesitás ayuda, escribinos a{' '}
            {CORREO_SOPORTE}.
          </div>
        )}

        {error && (
          <div className="panel panel--bad" style={{ marginBottom: 18 }}>
            {error}
          </div>
        )}

        <h4 style={{ margin: '8px 0 10px' }}>Documentación a enviar</h4>
        <p className="help" style={{ marginBottom: 12 }}>
          Enviá estos documentos a {CORREO_SOPORTE} indicando tu CUIT.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {DOCUMENTOS.map((documento) => (
            <div
              key={documento}
              className="row"
              style={{
                alignItems: 'center',
                padding: '10px 12px',
                border: '1px solid var(--bd)',
                borderRadius: 12,
              }}
            >
              <span>{documento}</span>
              <span
                className={`badge ${rechazado ? 'badge--bad' : 'badge--pend'}`}
                style={{ marginLeft: 'auto' }}
              >
                {rechazado ? 'Observada' : 'Pendiente'}
              </span>
            </div>
          ))}
        </div>

        <div
          className="row"
          style={{ flexWrap: 'wrap', gap: 8, marginTop: 20 }}
        >
          <button type="button" className="chip" onClick={copiarCorreo}>
            Copiar correo de soporte
          </button>
          <button
            type="button"
            className="chip chip--active"
            onClick={corregir}
          >
            {rechazado ? 'Corregir y reenviar' : 'Revisar mis datos'}
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => navigate('/perfil')}
          >
            Mi perfil
          </button>
          <button
            type="button"
            className="chip chip--danger"
            style={{ marginLeft: 'auto' }}
            onClick={salir}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </PageShell>
  );
}
