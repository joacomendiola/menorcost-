import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Center, Loader, Select, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import QRCode from 'qrcode';
import { useAuth } from '../../auth/contexto';
import { ApiError, pedidosApi, reportesApi, reputacionApi } from '../../api';
import type { PedidoTicket } from '../../api';
import { Badge, type BadgeTone } from '../../components/ui/Badge';

const MOTIVO_OTRO = 'Otro';

const MOTIVOS = [
  { value: 'Mal estado del producto', label: 'Mal estado del producto' },
  { value: 'Local cerrado', label: 'Local cerrado' },
  { value: 'No respetó el precio', label: 'No respetó el precio' },
  { value: MOTIVO_OTRO, label: 'Otro motivo' },
];

const ESTADO_META: Record<string, { label: string; tone: BadgeTone }> = {
  PENDIENTE_DE_RETIRO: { label: 'PENDIENTE_DE_RETIRO', tone: 'pend' },
  ENTREGADO: { label: 'ENTREGADO', tone: 'ok' },
  CANCELADO: { label: 'CANCELADO', tone: 'bad' },
  CANCELADO_POR_FALTA_RETIRO: {
    label: 'CANCELADO_POR_FALTA_RETIRO',
    tone: 'bad',
  },
};

const money = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function mensajeDeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Ocurrió un error inesperado. Intentá de nuevo.';
}

export function Ticket() {
  const { codigo } = useParams<{ codigo: string }>();
  const { token, cargando: cargandoSesion } = useAuth();
  const navigate = useNavigate();

  const [pedido, setPedido] = useState<PedidoTicket | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<{ codigo: string; dataUrl: string | null } | null>(
    null,
  );
  const qrDataUrl =
    qr && qr.codigo === pedido?.codigoQR ? qr.dataUrl : null;

  const [puntaje, setPuntaje] = useState(0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviandoCalificacion, setEnviandoCalificacion] = useState(false);

  const [motivo, setMotivo] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [enviandoReporte, setEnviandoReporte] = useState(false);

  useEffect(() => {
    if (!token || !codigo) return;
    let activo = true;

    const cargarPedido = async () => {
      try {
        const data = await pedidosApi.obtenerPorCodigo(token, codigo);
        if (activo) setPedido(data);
      } catch (err: unknown) {
        if (activo) setError(mensajeDeError(err));
      } finally {
        if (activo) setCargando(false);
      }
    };

    void cargarPedido();
    return () => {
      activo = false;
    };
  }, [token, codigo]);

  async function reintentar() {
    if (!token || !codigo) return;
    setCargando(true);
    setError(null);
    try {
      setPedido(await pedidosApi.obtenerPorCodigo(token, codigo));
    } catch (err: unknown) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    const codigoQR = pedido?.codigoQR;
    if (!codigoQR) return;

    let activo = true;
    QRCode.toDataURL(codigoQR, {
      width: 340,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0F172A', light: '#FFFFFF' },
    })
      .then((url) => {
        if (activo) setQr({ codigo: codigoQR, dataUrl: url });
      })
      .catch(() => {
        if (activo) setQr({ codigo: codigoQR, dataUrl: null });
      });

    return () => {
      activo = false;
    };
  }, [pedido?.codigoQR]);

  async function enviarCalificacion(evento: FormEvent) {
    evento.preventDefault();
    if (!pedido || !token) return;

    if (puntaje < 1 || puntaje > 5) {
      notifications.show({
        color: 'yellow',
        title: 'Falta la valoración',
        message: 'Debes seleccionar una valoración entre 1 y 5 estrellas',
      });
      return;
    }

    setEnviandoCalificacion(true);
    try {
      const respuesta = await reputacionApi.calificar(token, {
        idPedido: pedido.idPedido,
        puntaje,
        comentario: comentario.trim() ? comentario.trim() : undefined,
      });

      setPedido((previo) =>
        previo
          ? {
              ...previo,
              calificacion: {
                id: respuesta.calificacion.id_calificacion,
                puntaje: respuesta.calificacion.puntaje,
                comentario: respuesta.calificacion.comentario,
                fecha: respuesta.calificacion.fecha_creacion,
              },
            }
          : previo,
      );

      notifications.show({
        color: 'green',
        title: '¡Gracias!',
        message: 'Calificación cargada exitosamente',
      });
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'No se pudo calificar',
        message: mensajeDeError(err),
      });
    } finally {
      setEnviandoCalificacion(false);
    }
  }

  async function enviarReporte(evento: FormEvent) {
    evento.preventDefault();
    if (!pedido || !token) return;

    if (!motivo) {
      notifications.show({
        color: 'yellow',
        title: 'Falta el motivo',
        message: 'Elegí un motivo para reportar el problema',
      });
      return;
    }

    if (motivo === MOTIVO_OTRO && !descripcion.trim()) {
      notifications.show({
        color: 'yellow',
        title: 'Falta la descripción',
        message: 'Por favor, especifica brevemente el problema ocurrido',
      });
      return;
    }

    setEnviandoReporte(true);
    try {
      const reporte = await reportesApi.crear(token, {
        idPedido: pedido.idPedido,
        motivo,
        descripcion: descripcion.trim() ? descripcion.trim() : undefined,
        tipo_destino: 'COMERCIO',
      });

      setPedido((previo) =>
        previo
          ? {
              ...previo,
              misReportes: [
                {
                  id: reporte.id_reporte,
                  motivo: reporte.motivo,
                  estado: reporte.estado_reporte,
                  fecha: reporte.fecha_reporte,
                },
                ...previo.misReportes,
              ],
            }
          : previo,
      );

      notifications.show({
        color: 'green',
        title: 'Reporte enviado',
        message: 'El reporte quedó en revisión (PENDIENTE_REVISION).',
      });
      setMotivo(null);
      setDescripcion('');
      setDescripcion('');
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'No se pudo enviar el reporte',
        message: mensajeDeError(err),
      });
    } finally {
      setEnviandoReporte(false);
    }
  }

  if (!cargandoSesion && !token) {
    return (
      <main className="ticket-wrap">
        <div className="ticket-card">
          <h1 className="ticket-code ticket-code--error">Iniciá sesión</h1>
          <p className="ticket-note">
            Necesitás una sesión activa para ver este pedido.
          </p>
          <div className="ticket-form__actions" style={{ marginTop: 16 }}>
            <Button color="brand" onClick={() => navigate('/login')}>
              Ir a iniciar sesión
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (!codigo) {
    return (
      <main className="ticket-wrap">
        <div className="ticket-card">
          <h1 className="ticket-code ticket-code--error">Ticket no válido</h1>
          <p className="ticket-note">
            Falta el código del pedido en la dirección.
          </p>
        </div>
      </main>
    );
  }

  if (cargando) {
    return (
      <Center mih="60vh">
        <Loader color="brand" />
      </Center>
    );
  }

  if (error || !pedido) {
    return (
      <main className="ticket-wrap">
        <button
          type="button"
          className="ticket-back"
          onClick={() => navigate(-1)}
        >
          ← Volver
        </button>
        <div className="ticket-card">
          <h1 className="ticket-code ticket-code--error">Sin ticket</h1>
          <p className="ticket-note">
            {error ?? 'No pudimos encontrar este pedido.'}
          </p>
          <div className="ticket-form__actions" style={{ marginTop: 16 }}>
            <Button color="brand" onClick={() => void reintentar()}>
              Reintentar
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const estado = ESTADO_META[pedido.estado] ?? {
    label: pedido.estado,
    tone: 'neutro' as BadgeTone,
  };
  const valorEstrellas = hover || puntaje;
  const yaReportado = pedido.misReportes.length > 0;

  return (
    <main className="ticket-wrap">
      <button type="button" className="ticket-back" onClick={() => navigate(-1)}>
        ← Volver
      </button>

      <section className="ticket-card">
        {pedido.localAbierto === false && (
          <p className="ticket-alert" role="status">
            El local está cerrado en este momento. Tu pedido queda listo para
            retirarlo en la franja elegida.
          </p>
        )}

        <div className="ticket-card__top">
          <Badge tone={estado.tone}>{estado.label}</Badge>

          {qrDataUrl ? (
            <img
              className="ticket-qr"
              src={qrDataUrl}
              width={170}
              height={170}
              alt={`Código QR del pedido ${pedido.codigoAlfanumerico}`}
            />
          ) : (
            <div
              className="ticket-qr ticket-qr--empty"
              role="status"
              aria-label="Código QR no disponible"
            >
              {qr?.codigo === pedido.codigoQR
                ? 'No se pudo generar el QR'
                : 'Generando código QR…'}
            </div>
          )}

          <h1 className="ticket-code">{pedido.codigoAlfanumerico}</h1>
          <p className="ticket-note">
            Mostrá este QR en el local para retirar tu pedido.
          </p>
        </div>

        <dl className="ticket-rows">
          <div className="ticket-row">
            <dt>Local</dt>
            <dd>{pedido.comercio?.nombre ?? '—'}</dd>
          </div>

          {pedido.franjaHorario && (
            <div className="ticket-row">
              <dt>Franja de retiro</dt>
              <dd>
                {pedido.franjaHorario.inicio} – {pedido.franjaHorario.fin}
              </dd>
            </div>
          )}

          <div className="ticket-row">
            <dt>Pago</dt>
            <dd>
              <span className="ticket-paid">PAGADO</span> ·{' '}
              {money.format(pedido.total)}
            </dd>
          </div>

          {pedido.items.map((item) => (
            <div className="ticket-row" key={item.id}>
              <dt>
                {item.titulo} ×{item.cantidad}
              </dt>
              <dd>{money.format(item.subtotal)}</dd>
            </div>
          ))}
        </dl>

        <div className="ticket-total">
          <span>Total</span>
          <strong>{money.format(pedido.total)}</strong>
        </div>

        {pedido.estado === 'ENTREGADO' && (
          <section className="ticket-section">
            <h2>Calificá tu pedido</h2>

            {pedido.calificacion ? (
              <div className="ticket-calificacion">
                <span className="ticket-calificacion__stars" aria-hidden="true">
                  {'★'.repeat(pedido.calificacion.puntaje)}
                  <span className="ticket-calificacion__off">
                    {'★'.repeat(5 - pedido.calificacion.puntaje)}
                  </span>
                </span>
                <span className="ticket-note">
                  Calificación enviada
                  {pedido.calificacion.comentario
                    ? ` · “${pedido.calificacion.comentario}”`
                    : ''}
                </span>
              </div>
            ) : (
              <form className="ticket-form" onSubmit={enviarCalificacion}>
                <div
                  className="stars"
                  role="radiogroup"
                  aria-label="Valoración del pedido"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={puntaje === n}
                      aria-label={`${n} estrella${n > 1 ? 's' : ''}`}
                      className={`star-btn${n <= valorEstrellas ? ' is-active' : ''}`}
                      onMouseEnter={() => setHover(n)}
                      onMouseLeave={() => setHover(0)}
                      onFocus={() => setHover(n)}
                      onBlur={() => setHover(0)}
                      onClick={() => setPuntaje(n)}
                    >
                      ★
                    </button>
                  ))}
                </div>

                <div>
                  <Textarea
                    label="Comentario (opcional)"
                    placeholder="Contale al comercio cómo fue tu experiencia"
                    value={comentario}
                    onChange={(evento) =>
                      setComentario(evento.currentTarget.value)
                    }
                    maxLength={250}
                    autosize
                    minRows={3}
                    maxRows={6}
                  />
                  <p className="ticket-counter">{comentario.length}/250</p>
                </div>

                <div className="ticket-form__actions">
                  <Button
                    type="submit"
                    color="brand"
                    loading={enviandoCalificacion}
                  >
                    Enviar calificación
                  </Button>
                </div>
              </form>
            )}
          </section>
        )}

        {pedido.estado === 'PENDIENTE_DE_RETIRO' && (
          <section className="ticket-section">
            <p className="ticket-note">
              Podrás calificar y reportar cuando el pedido esté{' '}
              <strong>ENTREGADO</strong>.
            </p>
          </section>
        )}

        {pedido.estado !== 'CANCELADO' &&
          pedido.estado !== 'CANCELADO_POR_FALTA_RETIRO' && (
            <section className="ticket-section">
              <h2>Reportar problema</h2>

              {yaReportado ? (
                <p className="ticket-note">
                  Ya enviaste un reporte para este pedido. Estado:{' '}
                  <strong>{pedido.misReportes[0].estado}</strong>
                </p>
              ) : (
                <form className="ticket-form" onSubmit={enviarReporte}>
                  <Select
                    label="Motivo"
                    placeholder="Elegí un motivo"
                    data={MOTIVOS}
                    value={motivo}
                    onChange={setMotivo}
                    withAsterisk
                  />

                  <div>
                    <Textarea
                      label={
                        motivo === MOTIVO_OTRO
                          ? 'Descripción del problema'
                          : 'Descripción (opcional)'
                      }
                      placeholder="Contanos qué pasó"
                      value={descripcion}
                      onChange={(evento) =>
                        setDescripcion(evento.currentTarget.value)
                      }
                      maxLength={300}
                      autosize
                      minRows={3}
                      maxRows={6}
                      required={motivo === MOTIVO_OTRO}
                    />
                    <p className="ticket-counter">{descripcion.length}/300</p>
                  </div>

                  <div className="ticket-form__actions">
                    <Button
                      type="submit"
                      variant="default"
                      loading={enviandoReporte}
                    >
                      Enviar reporte
                    </Button>
                  </div>
                </form>
              )}
            </section>
          )}

        <div className="ticket-footer">
          <Link to="/" className="ticket-footer__link">
            Volver al inicio
          </Link>
        </div>
      </section>
    </main>
  );
}