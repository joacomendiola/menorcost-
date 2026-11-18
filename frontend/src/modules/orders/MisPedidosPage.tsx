import { Loader } from '@mantine/core';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ApiError,
  notificacionesApi,
  pedidosApi,
  type Notificacion,
  type PedidoResumen,
} from '../../api';
import { useAuth } from '../../auth/contexto';
import { Badge, type BadgeTone } from '../../components/ui/Badge';

const moneda = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const ESTADO_META: Record<string, { label: string; tone: BadgeTone }> = {
  PENDIENTE_DE_RETIRO: { label: 'PENDIENTE_DE_RETIRO', tone: 'pend' },
  ENTREGADO: { label: 'ENTREGADO', tone: 'ok' },
  CANCELADO: { label: 'CANCELADO', tone: 'bad' },
  CANCELADO_POR_FALTA_RETIRO: {
    label: 'CANCELADO_POR_FALTA_RETIRO',
    tone: 'bad',
  },
};

function mensajeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return 'No pudimos cargar tus pedidos.';
}

function detalleItems(pedido: PedidoResumen): string {
  return pedido.items
    .map((item) => `${item.titulo} x${item.cantidad}`)
    .join(', ');
}

export function MisPedidosPage() {
  const { token, cargando: cargandoSesion } = useAuth();
  const navigate = useNavigate();

  const [pedidos, setPedidos] = useState<PedidoResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [avisos, setAvisos] = useState<Notificacion[]>([]);

  useEffect(() => {
    if (!token) return;

    let activo = true;

    pedidosApi
      .listar(token)
      .then((data) => {
        if (!activo) return;

        setPedidos(data);
        setError('');
      })
      .catch((err: unknown) => {
        if (activo) setError(mensajeError(err));
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    // Avisos de pedidos (entrega / cancelación) al entrar a "Mis pedidos".
    notificacionesApi
      .listar(token)
      .then((data) => {
        if (!activo) return;

        setAvisos(data.filter((n) => !n.leida && n.tipo.startsWith('PEDIDO_')));
      })
      .catch(() => {
        // El aviso es secundario: si falla, la lista de pedidos igual se muestra.
      });

    return () => {
      activo = false;
    };
  }, [token]);

  async function descartarAviso(aviso: Notificacion) {
    if (!token) return;

    setAvisos((actuales) => actuales.filter((item) => item.id !== aviso.id));

    try {
      await notificacionesApi.marcarLeida(token, aviso.id);
    } catch {
      // Si falla, el aviso se vuelve a mostrar en la próxima visita.
    }
  }

  if (!cargandoSesion && !token) {
    return (
      <main className="comercio-page mis-pedidos-page">
        <div className="card card--left">
          <h1>Iniciá sesión</h1>
          <p className="muted">
            Necesitás una sesión activa para ver tus pedidos.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="comercio-page mis-pedidos-page">
      <button type="button" className="chip" onClick={() => navigate(-1)}>
        ← Volver
      </button>

      <h1 className="mis-pedidos-page__titulo">Mis pedidos</h1>

      {avisos.length > 0 && (
        <section
          className="mis-pedidos-avisos"
          aria-label="Avisos de pedidos"
          style={{ display: 'grid', gap: 12, marginBottom: 16 }}
        >
          {avisos.map((aviso) => (
            <article key={aviso.id} className="card card--left" role="status">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <div>
                  <strong>{aviso.titulo}</strong>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    {aviso.mensaje}
                  </p>
                </div>
                <button
                  type="button"
                  className="chip"
                  onClick={() => void descartarAviso(aviso)}
                >
                  Entendido
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {cargando ? (
        <div className="tienda-cargando">
          <Loader color="brand" />
        </div>
      ) : error ? (
        <section className="card card--left">
          <p role="alert">{error}</p>
        </section>
      ) : pedidos.length === 0 ? (
        <section className="card mis-pedidos-vacio">
          <h2>Todavía no tenés pedidos</h2>
          <p className="muted">
            Cuando compres en un comercio, tus pedidos van a aparecer acá.
          </p>
        </section>
      ) : (
        <section className="mis-pedidos-lista">
          {pedidos.map((pedido) => {
            const estado = ESTADO_META[pedido.estado] ?? {
              label: pedido.estado,
              tone: 'neutro' as BadgeTone,
            };
            const esPendiente = pedido.estado === 'PENDIENTE_DE_RETIRO';
            const franja = pedido.franjaHorario
              ? `Retiro ${pedido.franjaHorario.inicio} – ${pedido.franjaHorario.fin}`
              : 'Retiro a coordinar';

            return (
              <article
                key={pedido.idPedido}
                className="card card--left mis-pedido"
              >
                <div className="mis-pedido__cabecera">
                  <div>
                    <p className="mis-pedido__titulo">
                      <span className="mis-pedido__codigo">
                        #{pedido.codigoAlfanumerico}
                      </span>
                      <span className="mis-pedido__separador"> · </span>
                      {pedido.comercio?.nombre ?? 'Comercio'}
                    </p>

                    <p className="mis-pedido__detalle">
                      {franja} · {moneda.format(pedido.total)}
                      {pedido.items.length > 0
                        ? ` · ${detalleItems(pedido)}`
                        : ''}
                    </p>
                  </div>

                  <Badge tone={estado.tone}>{estado.label}</Badge>
                </div>

                <button
                  type="button"
                  className="mis-pedido__accion"
                  onClick={() =>
                    navigate(`/pedido/${pedido.codigoAlfanumerico}`)
                  }
                >
                  {esPendiente ? 'Ver ticket QR' : 'Ver detalle'}
                </button>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
