import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button, Select, Text, Textarea, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ApiError, pedidosApi, reportesApi } from '../../api';
import type {
  EntregaValidada,
  MotivoReporte,
  PedidoComercio,
  PedidoReportableComerciante,
} from '../../api';
import { useAuth } from '../../auth/contexto';
import { Badge } from '../../components/ui/Badge';
import { metaEstadoPago, metaEstadoPedido } from '../orders/estadosPedido';
import { Card } from '../../components/ui/Card';
import { EscanerQR } from './EscanerQR';

const MOTIVOS: Array<{ value: MotivoReporte; label: string }> = [
  {
    value: 'CLIENTE_NO_RETIRO',
    label: 'El cliente no se presentó a retirar el producto',
  },
  {
    value: 'CANCELACION_INDEBIDA',
    label: 'Cancelación indebida en mostrador',
  },
  {
    value: 'COMPORTAMIENTO_INADECUADO',
    label: 'Comportamiento inadecuado del cliente',
  },
  { value: 'OTRO', label: 'Otro motivo' },
];

const money = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 2,
});

const fecha = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function mensajeDeError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function PedidosPanel() {
  const { token, cerrarSesion } = useAuth();

  const [pedidos, setPedidos] = useState<PedidoReportableComerciante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [motivos, setMotivos] = useState<Record<string, MotivoReporte | null>>(
    {},
  );
  const [descripciones, setDescripciones] = useState<Record<string, string>>({});
  const [procesando, setProcesando] = useState<string | null>(null);

  // CU-2.06 — verificación de entrega en mostrador
  const [codigo, setCodigo] = useState('');
  const [validando, setValidando] = useState(false);
  const [validacion, setValidacion] = useState<EntregaValidada | null>(null);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  const [entregando, setEntregando] = useState(false);
  const [pedidosComercio, setPedidosComercio] = useState<PedidoComercio[]>([]);
  const [cancelando, setCancelando] = useState<string | null>(null);

  const manejarError = useCallback(
    (err: unknown, fallback: string) => {
      if (err instanceof ApiError && err.status === 401) {
        cerrarSesion();
        return null;
      }
      return mensajeDeError(err, fallback);
    },
    [cerrarSesion],
  );

  const cargar = useCallback(
    async (activa?: () => boolean) => {
      if (!token) return;

      try {
        const [reportables, todos] = await Promise.all([
          reportesApi.pedidosComerciante(token),
          pedidosApi.comercio(token),
        ]);
        if (!activa || activa()) {
          setPedidos(reportables);
          setPedidosComercio(todos);
          setError(null);
        }
      } catch (err) {
        const mensaje = manejarError(
          err,
          'No se pudieron cargar los pedidos. Intenta nuevamente.',
        );
        if (mensaje && (!activa || activa())) setError(mensaje);
      } finally {
        if (!activa || activa()) setCargando(false);
      }
    },
    [token, manejarError],
  );

  useEffect(() => {
    let activa = true;

    const cargarInicial = async () => {
      await cargar(() => activa);
    };

    void cargarInicial();

    return () => {
      activa = false;
    };
  }, [cargar]);

  async function validarCodigo(valor: string) {
    if (!token) return;
    const limpio = valor.trim();

    if (!limpio) {
      setErrorValidacion('Ingresá o escaneá el código del pedido.');
      return;
    }

    setValidando(true);
    setErrorValidacion(null);
    setValidacion(null);

    try {
      const resultado = await pedidosApi.validarEntrega(token, limpio);
      setValidacion(resultado);
      setCodigo(resultado.pedido.codigoAlfanumerico);
    } catch (err) {
      setErrorValidacion(
        manejarError(err, 'No pudimos validar el código. Intenta de nuevo.'),
      );
    } finally {
      setValidando(false);
    }
  }

  async function confirmarEntrega() {
    if (!token || !validacion) return;

    setEntregando(true);
    try {
      const resultado = await pedidosApi.entregar(
        token,
        validacion.pedido.idPedido,
      );

      notifications.show({
        color: 'green',
        title: 'Entrega confirmada',
        message: resultado.yaEntregado
          ? 'Ese pedido ya figuraba como entregado.'
          : `Pedido ${validacion.pedido.codigoAlfanumerico} entregado. El cliente ya puede calificar y reportar.`,
      });

      setValidacion(null);
      setCodigo('');
      await cargar();
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'No se pudo confirmar la entrega',
        message:
          manejarError(err, 'Ocurrió un error inesperado.') ??
          'Ocurrió un error inesperado.',
      });
    } finally {
      setEntregando(false);
    }
  }

  async function cancelarPedido(pedido: PedidoComercio) {
    if (!token) return;

    setCancelando(pedido.idPedido);
    try {
      await pedidosApi.cancelar(token, pedido.idPedido);
      notifications.show({
        color: 'green',
        title: 'Pedido cancelado',
        message: `Se canceló el pedido ${pedido.codigoAlfanumerico} y se liberó el stock reservado.`,
      });
      await cargar();
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'No se pudo cancelar',
        message:
          manejarError(err, 'Ocurrió un error inesperado.') ??
          'Ocurrió un error inesperado.',
      });
    } finally {
      setCancelando(null);
    }
  }

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
    if (motivo === 'OTRO' && !descripcion) {
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
        motivoCodigo: motivo,
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
                  motivoCodigo: reporte.motivoCodigo ?? motivo,
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
      const mensaje = manejarError(
        err,
        'Ocurrió un error inesperado. Intenta nuevamente.',
      );
      if (!mensaje) return;
      notifications.show({
        color: 'red',
        title: 'No se pudo enviar el reporte',
        message: mensaje,
      });
    } finally {
      setProcesando(null);
    }
  }

  const pendientesDePago = pedidosComercio.filter(
    (pedido) => pedido.estado === 'PENDIENTE_PAGO',
  );

  return (
    <main className="merchant-content">
      <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
        <Card className="delivery-verification-card" padding="sm" shadow="sm">
          <h2 style={{ margin: '0 0 6px' }}>Verificar entrega</h2>
          <p className="muted" style={{ margin: '0 0 12px' }}>
            Escaneá el QR del cliente o ingresá el código alfanumérico del
            ticket para confirmar la entrega en mostrador.
          </p>

          <form
            onSubmit={(evento) => {
              evento.preventDefault();
              void validarCodigo(codigo);
            }}
            style={{ display: 'grid', gap: 8 }}
          >
            <TextInput
              label="Código del pedido"
              placeholder="Ej. MC7K2P9A"
              value={codigo}
              onChange={(evento) => setCodigo(evento.currentTarget.value)}
              maxLength={100}
              autoComplete="off"
            />

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Button type="submit" loading={validando}>
                Validar código
              </Button>
              <EscanerQR
                onCodigo={(valor) => {
                  setCodigo(valor);
                  void validarCodigo(valor);
                }}
              />
            </div>
          </form>

          {errorValidacion && (
            <Text c="red" role="alert" mt="sm">
              {errorValidacion}
            </Text>
          )}

          {validacion && (
            <div
              style={{
                border: '1px solid var(--bd)',
                borderRadius: 16,
                padding: 16,
                marginTop: 16,
                display: 'grid',
                gap: 8,
              }}
            >
              <Text fw={700}>
                Pedido {validacion.pedido.codigoAlfanumerico} ·{' '}
                {money.format(validacion.pedido.total)}
              </Text>
              <Text size="sm">
                Cliente:{' '}
                {validacion.pedido.cliente
                  ? `${validacion.pedido.cliente.nombre} ${validacion.pedido.cliente.apellido}`
                  : '—'}
              </Text>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <EstadoPedidoBadge estado={validacion.pedido.estado} />
                <CobroBadge estado={validacion.pedido.pagoEstado} />
              </div>
              <Text size="sm">
                {validacion.pedido.items
                  .map((item) => `${item.cantidad}× ${item.titulo}`)
                  .join(', ') || 'Sin artículos'}
              </Text>

              {validacion.puedeEntregar ? (
                <Button
                  color="green"
                  loading={entregando}
                  onClick={() => void confirmarEntrega()}
                >
                  Confirmar entrega
                </Button>
              ) : (
                <Text c="orange" role="alert">
                  {validacion.motivo ?? 'Este pedido no se puede entregar.'}
                </Text>
              )}
            </div>
          )}
        </Card>

        {pendientesDePago.length > 0 && (
          <Card className="reviews-card">
            <h2 style={{ marginTop: 0 }}>Pedidos pendientes de pago</h2>
            <p className="muted" style={{ marginBottom: 16 }}>
              Si el cliente no terminó el pago, podés cancelar el pedido para
              liberar el stock reservado. No se cobró nada.
            </p>

            <div style={{ display: 'grid', gap: 12 }}>
              {pendientesDePago.map((pedido) => (
                <article
                  key={pedido.idPedido}
                  style={{
                    border: '1px solid var(--bd)',
                    borderRadius: 16,
                    padding: 16,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <Text fw={600}>{pedido.codigoAlfanumerico}</Text>
                    <Text size="sm" c="dimmed">
                      {fecha.format(new Date(pedido.fechaPedido))} ·{' '}
                      {money.format(pedido.total)}
                      {pedido.cliente
                        ? ` · ${pedido.cliente.nombre} ${pedido.cliente.apellido}`
                        : ''}
                    </Text>
                  </div>
                  <Button
                    color="red"
                    variant="light"
                    loading={cancelando === pedido.idPedido}
                    onClick={() => void cancelarPedido(pedido)}
                  >
                    Cancelar pedido
                  </Button>
                </article>
              ))}
            </div>
          </Card>
        )}

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
              <Button mt="sm" variant="default" onClick={() => void cargar()}>
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
                    {pedido.usuario
                      ? `Cliente: ${pedido.usuario.nombre} ${pedido.usuario.apellido} · `
                      : ''}
                    Total: {money.format(Number(pedido.total))}
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <EstadoPedidoBadge estado={pedido.estado} />
                  </div>
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
                            [pedido.id_pedido]: valor as MotivoReporte | null,
                          }))
                        }
                        required
                      />
                      <Textarea
                        label={
                          motivos[pedido.id_pedido] === 'OTRO'
                            ? 'Descripción del problema'
                            : 'Descripción (opcional)'
                        }
                        value={descripciones[pedido.id_pedido] ?? ''}
                        onChange={(evento) => {
                          // El valor se lee acá: dentro del updater el evento
                          // ya no tiene `currentTarget` (React lo limpia) y en
                          // desarrollo StrictMode re-invoca el updater.
                          const valor = evento.currentTarget.value;
                          setDescripciones((actuales) => ({
                            ...actuales,
                            [pedido.id_pedido]: valor,
                          }));
                        }}
                        maxLength={300}
                        required={motivos[pedido.id_pedido] === 'OTRO'}
                        autosize
                        minRows={2}
                        maxRows={5}
                      />
                      <Button
                        type="submit"
                        variant="default"
                        loading={procesando === pedido.id_pedido}
                        disabled={
                          procesando !== null && procesando !== pedido.id_pedido
                        }
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

/** Etiqueta en castellano y color semántico para el estado del pedido. */
function EstadoPedidoBadge({ estado }: { estado: string }) {
  const meta = metaEstadoPedido(estado);

  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

/** Bloque destacado del cobro: el comerciante ve de un vistazo si está pago. */
function CobroBadge({ estado }: { estado: string | null }) {
  const meta = metaEstadoPago(estado);

  return (
    <div className="pedido-cobro" role="group" aria-label="Estado del cobro">
      <span className="pedido-cobro__label">Cobro</span>
      <Badge tone={meta.tone}>{meta.label}</Badge>
      <span className="pedido-cobro__medio">Mercado Pago</span>
    </div>
  );
}
