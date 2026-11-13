import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader } from '@mantine/core';
import { reputacionApi, type ReputacionComercio } from '../../api';
import { useAuth } from '../../auth/contexto';
import { Card } from '../../components/ui/Card';
import { comerciosApi, type Comercio, type EstadoComercio } from '../../comercios/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface OfferDashboardSummary {
  total: number;
  activas: number;
  pausadas: number;
  proximasAVencer: number;
  vencidas: number;
  sinStock: number;
  unidadesReservadas: number;
}

const ESTADO_COMERCIO: Record<EstadoComercio, { etiqueta: string; clase: string }> = {
  PENDIENTE_VERIFICACION: { etiqueta: 'Pendiente', clase: 'badge--pend' },
  HABILITADO: { etiqueta: 'Habilitado', clase: 'badge--ok' },
  DOCUMENTACION_RECHAZADA: { etiqueta: 'Rechazado', clase: 'badge--bad' },
  SUSPENDIDO: { etiqueta: 'Suspendido', clase: 'badge--bad' },
  ELIMINADO: { etiqueta: 'Eliminado', clase: 'badge--bad' },
};

async function obtenerResumenOfertas(
  token: string,
): Promise<OfferDashboardSummary | null> {
  try {
    const respuesta = await fetch(`${API_URL}/offers/dashboard-summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!respuesta.ok) return null;
    return (await respuesta.json()) as OfferDashboardSummary;
  } catch {
    return null;
  }
}

function Metrica({ valor, etiqueta }: { valor: number | string; etiqueta: string }) {
  return (
    <div className="card card--left" style={{ minWidth: 140, flex: '1 1 140px' }}>
      <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>{valor}</div>
      <div className="muted" style={{ marginTop: 4 }}>
        {etiqueta}
      </div>
    </div>
  );
}

export function ResumenPanel() {
  const { token } = useAuth();
  const [comercio, setComercio] = useState<Comercio | null>(null);
  const [resumen, setResumen] = useState<OfferDashboardSummary | null>(null);
  const [reputacion, setReputacion] = useState<ReputacionComercio | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!token) return;

    let activo = true;

    async function cargar() {
      const [datosComercio, datosResumen, datosReputacion] = await Promise.all([
        comerciosApi.mio(token!).catch(() => null),
        obtenerResumenOfertas(token!),
        reputacionApi
          .obtenerMiReputacion(token!, { limit: 1 })
          .catch(() => null),
      ]);

      if (!activo) return;
      setComercio(datosComercio);
      setResumen(datosResumen);
      setReputacion(datosReputacion);
      setCargando(false);
    }

    void cargar();

    return () => {
      activo = false;
    };
  }, [token]);

  if (cargando) {
    return (
      <main className="merchant-content">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader color="brand" />
        </div>
      </main>
    );
  }

  const estado = comercio ? ESTADO_COMERCIO[comercio.estado] : null;

  return (
    <main className="merchant-content">
      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Resumen de mi comercio</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Estado del local, ofertas y reputación en un solo lugar.
        </p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Card className="reviews-card">
          <div className="row" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0 }}>
            {comercio?.nombreFantasia ?? 'Comercio sin registrar'}
          </h3>
          {estado && (
            <span className={`badge ${estado.clase}`}>{estado.etiqueta}</span>
          )}
          {comercio && (
            <span
              className={`badge ${comercio.abierto ? 'badge--ok' : 'badge--pend'}`}
            >
              {comercio.abierto ? 'Local abierto' : 'Local cerrado'}
            </span>
          )}
          {comercio && (
            <span
              className={`badge ${comercio.mercadoPagoVinculado ? 'badge--ok' : 'badge--bad'}`}
            >
              {comercio.mercadoPagoVinculado
                ? 'Mercado Pago vinculado'
                : 'Mercado Pago sin vincular'}
            </span>
          )}
        </div>

        {!comercio && (
          <p className="muted" style={{ marginBottom: 0, marginTop: 12 }}>
            Todavía no registraste tu comercio.{' '}
            <Link to="/comercios/registro">Completá el registro</Link> para
            empezar a publicar ofertas.
          </p>
        )}
        </Card>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Metrica valor={resumen?.activas ?? 0} etiqueta="Ofertas activas" />
        <Metrica valor={resumen?.pausadas ?? 0} etiqueta="Pausadas" />
        <Metrica valor={resumen?.proximasAVencer ?? 0} etiqueta="Próximas a vencer" />
        <Metrica valor={resumen?.sinStock ?? 0} etiqueta="Sin stock" />
        <Metrica
          valor={
            reputacion && reputacion.totalResenas > 0
              ? reputacion.promedio.toFixed(1)
              : '—'
          }
          etiqueta={`Reputación (${reputacion?.totalResenas ?? 0})`}
        />
      </div>

      <Card className="reviews-card">
        <h3 style={{ marginTop: 0 }}>Accesos rápidos</h3>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <Link className="ui-chip ui-chip--active" to="/panel/productos">
            Mis productos
          </Link>
          <Link className="ui-chip" to="/panel/pedidos">
            Pedidos
          </Link>
          <Link className="ui-chip" to="/panel/mi-local">
            Mi local
          </Link>
          <Link className="ui-chip" to="/panel/horarios">
            Horarios
          </Link>
          <Link className="ui-chip" to="/panel/reputacion">
            Reputación
          </Link>
        </div>
      </Card>
    </main>
  );
}
