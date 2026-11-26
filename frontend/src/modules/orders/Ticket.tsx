import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Center, Loader, Select, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import QRCode from 'qrcode';
import { useAuth } from '../../auth/contexto';
import { ApiError, pedidosApi, reportesApi, reputacionApi } from '../../api';
import type { MotivoReporte, PedidoTicket } from '../../api';
import { Badge } from '../../components/ui/Badge';
import { checkoutApi } from './checkoutApi';
import { metaEstadoPago, metaEstadoPedido } from './estadosPedido';
import { redirigirFueraDeLaApp } from './redireccion';

const MOTIVOS: Array<{ value: MotivoReporte; label: string }> = [
  {
    value: 'PRODUCTO_MAL_ESTADO',
    label: 'El producto estaba en mal estado/era diferente',
  },
  {
    value: 'COMERCIO_CERRADO',
    label: 'El comercio estaba cerrado al ir a retirar',
  },
  {
    value: 'PRECIO_NO_RESPETADO',
    label: 'El comercio no respetó el precio',
  },
  { value: 'OTRO', label: 'Otro motivo' },
];

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

  const [motivo, setMotivo] = useState<MotivoReporte | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [enviandoReporte, setEnviandoReporte] = useState(false);
  const [reintentandoPago, setReintentandoPago] = useState(false);

  const pagoPagado = pedido?.pagoEstado === 'PAGADO';

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
    // El QR solo se muestra cuando el pago está aprobado.
    const codigoQR = pagoPagado ? pedido?.codigoQR : undefined;
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
  }, [pedido?.codigoQR, pagoPagado]);

  async function reintentarPago() {
    if (!token || !pedido) return;

    setReintentandoPago(true);

    try {
      const checkout = await checkoutApi.reintentar(token, pedido.idPedido);

      if (checkout.urlRedireccion) {
        redirigirFueraDeLaApp(checkout.urlRedireccion);
        return;
      }

      navigate(
        `/checkout/resultado?idPedido=${encodeURIComponent(checkout.idPedido)}`,
      );
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'No se pudo reintentar el pago',
        message: mensajeDeError(err),
      });
    } finally {
      setReintentandoPago(false);
    }
  }

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

    if (motivo === 'OTRO' && !descripcion.trim()) {
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
        motivoCodigo: motivo,
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
                  motivoCodigo: reporte.motivoCodigo ?? motivo,
                  estado: reporte.estado_reporte,
                  fecha: reporte.fecha_reporte,
                },
                ...previo.misReportes,
              ],
            }
          : previo,
      );

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
              message: 'El reporte quedó en revisión (PENDIENTE_REVISION).',
            },
      );
      setMotivo(null);
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

  const estado = metaEstadoPedido(pedido.estado);
  const valorEstrellas = hover || puntaje;
  const reporteAbierto = pedido.misReportes.find((reporte) =>
    ['PENDIENTE_REVISION', 'BAJO_INVESTIGACION'].includes(reporte.estado),
  );
  // El cliente solo reporta pedidos ya entregados (CU-2.06).
  const puedeReportar = pedido.estado === 'ENTREGADO';
  const pagoMeta = metaEstadoPago(pedido.pagoEstado);

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

          {pagoPagado ? (
            qrDataUrl ? (
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
            )
          ) : (
            <div
              className="ticket-qr ticket-qr--empty"
              role="status"
              aria-label="Código QR no disponible"
            >
              {pedido.estado === 'PENDIENTE_PAGO'
                ? 'Pago pendiente'
                : 'QR no disponible'}
            </div>
          )}

          <h1 className="ticket-code">{pedido.codigoAlfanumerico}</h1>
          <p className="ticket-note">
            {pagoPagado
              ? 'Mostrá este QR en el local para retirar tu pedido.'
              : pedido.estado === 'PENDIENTE_PAGO'
                ? 'El QR se habilita cuando Mercado Pago confirme el pago.'
                : 'El QR no está disponible porque el pago no figura como aprobado.'}
          </p>

          {pedido.estado === 'PENDIENTE_PAGO' && (
            <Button
              color="brand"
              mt="sm"
              loading={reintentandoPago}
              onClick={() => void reintentarPago()}
            >
              Reintentar pago
            </Button>
          )}
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
              <Badge tone={pagoMeta.tone}>{pagoMeta.label}</Badge> ·{' '}
              {money.format(Number(pedido.total))}
            </dd>
          </div>

          {pedido.fechaEntrega && (
            <div className="ticket-row">
              <dt>Entregado</dt>
              <dd>
                {new Intl.DateTimeFormat('es-AR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                }).format(new Date(pedido.fechaEntrega))}
              </dd>
            </div>
          )}

          {pedido.items.map((item) => (
            <div className="ticket-row" key={item.id}>
              <dt>
                {item.titulo} ×{item.cantidad}
              </dt>
              <dd>{money.format(Number(item.subtotal))}</dd>
            </div>
          ))}
        </dl>

        <div className="ticket-total">
          <span>Total</span>
          <strong>{money.format(Number(pedido.total))}</strong>
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

        {puedeReportar && (
          <section className="ticket-section">
            <h2>Reportar problema</h2>

            {reporteAbierto ? (
              <p className="ticket-note">
                Ya enviaste un reporte para este pedido. Estado:{' '}
                <strong>{reporteAbierto.estado}</strong>
              </p>
            ) : (
              <form className="ticket-form" onSubmit={enviarReporte}>
                <Select
                  label="Motivo"
                  placeholder="Elegí un motivo"
                  data={MOTIVOS}
                  value={motivo}
                  onChange={(valor) =>
                    setMotivo(valor as MotivoReporte | null)
                  }
                  withAsterisk
                />

                <div>
                  <Textarea
                    label={
                      motivo === 'OTRO'
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
                    required={motivo === 'OTRO'}
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