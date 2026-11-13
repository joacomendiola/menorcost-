import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button, Select, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ApiError, reportesApi } from '../../api';
import type { PedidoReportableComerciante } from '../../api';
import { useAuth } from '../../auth/contexto';
import { Card } from '../../components/ui/Card';

const MOTIVO_OTRO = 'Otro motivo';
const MOTIVOS = [
  {
    value: 'El cliente no se presentó a retirar el producto',
    label: 'El cliente no se presentó a retirar el producto',
  },
  {
    value: 'Cancelación indebida en mostrador',
    label: 'Cancelación indebida en mostrador',
  },
  {
    value: 'Comportamiento inadecuado del cliente',
    label: 'Comportamiento inadecuado del cliente',
  },
  { value: MOTIVO_OTRO, label: MOTIVO_OTRO },
];

const ESTADOS: Record<string, string> = {
  PENDIENTE_DE_RETIRO: 'Pendiente de retiro',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
  CANCELADO_POR_FALTA_RETIRO: 'Cancelado por falta de retiro',
};

const money = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 2,
});

export function PedidosPanel() {
  const { token, cerrarSesion } = useAuth();
  const [pedidos, setPedidos] = useState<PedidoReportableComerciante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [motivos, setMotivos] = useState<Record<string, string | null>>({});
  const [descripciones, setDescripciones] = useState<Record<string, string>>({});
  const [procesando, setProcesando] = useState<string | null>(null);

  const cargarPedidos = useCallback(async (activa?: () => boolean) => {
    if (!token) return;
    setCargando(true);
    setError(null);
    try {
      const resultado = await reportesApi.pedidosComerciante(token);
      if (!activa || activa()) setPedidos(resultado);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        cerrarSesion();
        return;
      }
      if (!activa || activa()) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'No se pudieron cargar los pedidos. Intenta nuevamente.',
        );
      }
    } finally {
      if (!activa || activa()) setCargando(false);
    }
  }, [token, cerrarSesion]);

  useEffect(() => {
    let activa = true;
    void cargarPedidos(() => activa);
    return () => {
      activa = false;
    };
  }, [cargarPedidos]);

  async function enviarReporte(
    evento: FormEvent<HTMLFormElement>,
    pedido: PedidoReportableComerciante,
  ) {
    evento.preventDefault();
    if (!token) return;
    const motivo = motivos[pedido.id_pedido];
    const descripcion = descripciones[pedido.id_pedido]?.trim() ?? '';

    if (!motivo) {
      notifications.show({
        color: 'yellow',
        title: 'Falta el motivo',
        message: 'Elegí un motivo para reportar el problema',
      });
      return;
    }
    if (motivo === MOTIVO_OTRO && !descripcion) {
      notifications.show({
        color: 'yellow',
        title: 'Falta la descripción',
        message: 'Especificá brevemente el problema ocurrido',
      });
      return;
    }

    setProcesando(pedido.id_pedido);
    try {
      const reporte = await reportesApi.crear(token, {
        idPedido: pedido.id_pedido,
        motivo,
        descripcion: descripcion || undefined,
        tipo_destino: 'CLIENTE',
      });
      setPedidos((actuales) =>
        actuales.map((actual) =>
          actual.id_pedido === pedido.id_pedido
            ? {
                ...actual,
                reporteAbierto: {
                  id_reporte: reporte.id_reporte,
                  motivo: reporte.motivo,
                  estado_reporte: reporte.estado_reporte,
                  fecha_reporte: reporte.fecha_reporte,
                },
              }
            : actual,
        ),
      );
      setMotivos((actuales) => ({ ...actuales, [pedido.id_pedido]: null }));
      setDescripciones((actuales) => ({
        ...actuales,
        [pedido.id_pedido]: '',
      }));
      notifications.show(
        reporte.notificacionSoporte?.enviada === false
          ? {
              color: 'yellow',
              title: 'Reporte enviado; soporte no notificado',
              message:
                reporte.notificacionSoporte?.aviso ??
                'El reporte se guardó, pero no se pudo notificar al soporte.',
            }
          : {
              color: 'green',
              title: 'Reporte enviado',
              message: 'El reporte quedó en revisión.',
            },
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        cerrarSesion();
        return;
      }
      notifications.show({
        color: 'red',
        title: 'No se pudo enviar el reporte',
        message:
          err instanceof ApiError
            ? err.message
            : 'Ocurrió un error inesperado. Intenta nuevamente.',
      });
    } finally {
      setProcesando(null);
    }
  }

  return (
    <main className="merchant-content">
      <div style={{ marginTop: 16 }}>
        <Card className="reviews-card">
          <h2 style={{ marginTop: 0 }}>Pedidos</h2>
          <p className="muted" style={{ marginBottom: 16 }}>
            Revisá los pedidos de tu comercio y reportá incidencias para que
            soporte pueda revisarlas.
          </p>

          {cargando ? (
            <Text role="status">Cargando pedidos...</Text>
          ) : error ? (
            <div role="alert">
              <Text c="red">{error}</Text>
              <Button
                mt="sm"
                variant="default"
                onClick={() => void cargarPedidos()}
              >
                Reintentar
              </Button>
            </div>
          ) : pedidos.length === 0 ? (
            <Text c="dimmed">No hay pedidos disponibles para reportar.</Text>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {pedidos.map((pedido) => (
                <article
                  key={pedido.id_pedido}
                  style={{
                    border: '1px solid var(--bd)',
                    borderRadius: 16,
                    padding: 16,
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>
                    Pedido {pedido.codigoAlfanumerico}
                  </h3>
                  <p>
                    Estado: {ESTADOS[pedido.estado] ?? pedido.estado} · Total:{' '}
                    {money.format(Number(pedido.total))}
                  </p>
                  <p>
                    {pedido.items
                      .map((item) => `${item.cantidad}× ${item.producto.titulo}`)
                      .join(', ') || 'Sin artículos'}
                  </p>

                  {pedido.reporteAbierto ? (
                    <p role="status">
                      Ya enviaste un reporte para este pedido. Estado:{' '}
                      <strong>{pedido.reporteAbierto.estado_reporte}</strong>
                    </p>
                  ) : (
                    <form
                      onSubmit={(evento) => void enviarReporte(evento, pedido)}
                      style={{ display: 'grid', gap: 12 }}
                    >
                      <Select
                        label="Motivo"
                        placeholder="Elegí un motivo"
                        data={MOTIVOS}
                        value={motivos[pedido.id_pedido] ?? null}
                        onChange={(valor) =>
                          setMotivos((actuales) => ({
                            ...actuales,
                            [pedido.id_pedido]: valor,
                          }))
                        }
                        required
                      />
                      <Textarea
                        label={
                          motivos[pedido.id_pedido] === MOTIVO_OTRO
                            ? 'Descripción del problema'
                            : 'Descripción (opcional)'
                        }
                        value={descripciones[pedido.id_pedido] ?? ''}
                        onChange={(evento) =>
                          setDescripciones((actuales) => ({
                            ...actuales,
                            [pedido.id_pedido]: evento.currentTarget.value,
                          }))
                        }
                        maxLength={300}
                        required={motivos[pedido.id_pedido] === MOTIVO_OTRO}
                        autosize
                        minRows={2}
                        maxRows={5}
                      />
                      <Button
                        type="submit"
                        variant="default"
                        loading={procesando === pedido.id_pedido}
                        disabled={procesando !== null && procesando !== pedido.id_pedido}
                      >
                        Reportar problema
                      </Button>
                    </form>
                  )}
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
