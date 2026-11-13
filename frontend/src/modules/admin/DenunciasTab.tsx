import { useState } from 'react';
import { Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { adminApi, type AdminDenuncia, type EstadoUsuario } from '../../api';
import { useAuth } from '../../auth/contexto';
import { Badge, type BadgeTone } from '../../components/ui/Badge';
import { useAdminContext } from './adminContext';
import { useAdminList } from './useAdminList';
import {
  ESTADO_ABIERTAS,
  esSesionVencida,
  formatFechaLarga,
  formatPesos,
  mensajeError,
  nombreCompleto,
} from './adminFormat';
import {
  AdminEmpty,
  AdminItem,
  AdminLista,
  AdminResult,
  AdminRows,
  AdminSkeleton,
  ConfirmDialog,
} from './AdminUI';

const ESTADO_BADGE: Record<
  AdminDenuncia['estado_reporte'],
  { tone: BadgeTone; label: string }
> = {
  BAJO_INVESTIGACION: { tone: 'bad', label: 'Bajo investigación' },
  PENDIENTE_REVISION: { tone: 'pend', label: 'En revisión' },
  RESUELTO: { tone: 'ok', label: 'Resuelta' },
  DESESTIMADO: { tone: 'neutro', label: 'Desestimada' },
};

const ESTADO_PEDIDO: Record<string, string> = {
  PENDIENTE_DE_RETIRO: 'Pendiente de retiro',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
  CANCELADO_POR_FALTA_RETIRO: 'Cancelado por falta de retiro',
};

const FORMA_PAGO: Record<string, string> = {
  MERCADO_PAGO: 'Mercado Pago',
};

const ESTADO_CUENTA: Record<EstadoUsuario, string> = {
  HABILITADO: 'Habilitada',
  PENDIENTE_VERIFICACION: 'Pendiente de verificación',
  SUSPENDIDO: 'Suspendida',
  SOLICITUD_BAJA_PENDIENTE: 'Baja solicitada',
  BAJO_INVESTIGACION: 'Bajo investigación',
  DOCUMENTACION_RECHAZADA: 'Documentación rechazada',
};

type Accion = 'investigacion' | 'resolver' | 'sancionar' | 'rehabilitar';

export function DenunciasTab() {
  const { token, cerrarSesion } = useAuth();
  const { search, estado, refrescarKpis } = useAdminContext();
  const { items, cargando, error, recargar } = useAdminList<AdminDenuncia>(
    async (t) => {
      // El backend filtra por un solo estado: «abiertas» se resuelve acá.
      if (estado !== ESTADO_ABIERTAS) return adminApi.denuncias(t, { search, estado });
      const todas = await adminApi.denuncias(t, { search });
      return todas.filter(
        (d) => d.estado_reporte === 'PENDIENTE_REVISION' || d.estado_reporte === 'BAJO_INVESTIGACION',
      );
    },
    [search, estado],
  );

  const [procesando, setProcesando] = useState<number | null>(null);
  const [sancionando, setSancionando] = useState<AdminDenuncia | null>(null);
  const [rehabilitando, setRehabilitando] = useState<AdminDenuncia | null>(null);
  const [resultado, setResultado] = useState<{ tone: 'ok' | 'warn'; texto: string } | null>(null);

  async function ejecutar(d: AdminDenuncia, accion: Accion) {
    if (!token) return;
    setProcesando(d.id_reporte);
    try {
      const objetivo = nombreCompleto(d.denunciado);
      if (accion === 'investigacion') {
        const act = await adminApi.toggleInvestigacion(token, d.id_reporte);
        setResultado({
          tone: 'ok',
          texto:
            act.estado_reporte === 'BAJO_INVESTIGACION'
              ? `Denuncia #${d.id_reporte}: investigación abierta. La cuenta de ${objetivo} queda bajo investigación.`
              : `Denuncia #${d.id_reporte}: investigación cerrada. Vuelve a estado En revisión.`,
        });
      } else if (accion === 'resolver') {
        await adminApi.resolverDenuncia(token, d.id_reporte);
        setResultado({
          tone: 'ok',
          texto: `Denuncia #${d.id_reporte} resuelta. No se aplicaron sanciones a ${objetivo}.`,
        });
      } else if (accion === 'rehabilitar') {
        await adminApi.rehabilitarUsuario(token, d.denunciado.id);
        setResultado({
          tone: 'ok',
          texto: `La cuenta de ${objetivo} volvió a estado HABILITADO.`,
        });
        setRehabilitando(null);
      } else {
        const resp = await adminApi.sancionarDenuncia(token, d.id_reporte);
        const cierre =
          resp.denunciasCerradas > 0
            ? ` También se cerraron ${resp.denunciasCerradas} denuncia(s) abierta(s) del mismo usuario.`
            : '';
        setResultado(
          resp.notificacion.enviada
            ? {
                tone: 'ok',
                texto: `La cuenta de ${objetivo} pasó a SUSPENDIDO y se le notificó por correo.${cierre}`,
              }
            : {
                tone: 'warn',
                texto: `${objetivo} fue suspendido. ${resp.notificacion.aviso ?? 'No se pudo enviar el correo.'}${cierre}`,
              },
        );
        setSancionando(null);
      }
      refrescarKpis();
      await recargar();
    } catch (err) {
      if (esSesionVencida(err)) {
        cerrarSesion();
        return;
      }
      notifications.show({ message: mensajeError(err), color: 'bad' });
      setSancionando(null);
      setRehabilitando(null);
      void recargar();
    } finally {
      setProcesando(null);
    }
  }

  return (
    <>
      {resultado && <AdminResult tone={resultado.tone}>{resultado.texto}</AdminResult>}

      {cargando && items.length === 0 ? (
        <AdminSkeleton />
      ) : error ? (
        <AdminEmpty>
          {error}{' '}
          <button type="button" className="link-button" onClick={() => void recargar()}>
            Reintentar
          </button>
        </AdminEmpty>
      ) : items.length === 0 ? (
        <AdminEmpty>
          {estado === ESTADO_ABIERTAS ? 'No hay denuncias abiertas.' : 'No hay denuncias para mostrar.'}
        </AdminEmpty>
      ) : (
        <AdminLista>
          {items.map((d, idx) => {
            const badge = ESTADO_BADGE[d.estado_reporte];
            const abierta =
              d.estado_reporte === 'PENDIENTE_REVISION' ||
              d.estado_reporte === 'BAJO_INVESTIGACION';
            const suspendido = d.denunciado.estado === 'SUSPENDIDO';
            const ocupado = procesando === d.id_reporte;
            const bloqueado = procesando !== null;
            const pedido = d.pedido;
            const codigo = pedido?.codigoAlfanumerico ?? d.id_pedido.slice(0, 8).toUpperCase();
            const articulos = pedido?.items?.length
              ? pedido.items.map((it) => `${it.cantidad}× ${it.producto.titulo}`).join(', ')
              : '—';

            return (
              <AdminItem
                key={d.id_reporte}
                defaultOpen={idx === 0}
                avatar="!!"
                titulo={`Pedido #${codigo} — "${d.motivo}"`}
                subtitulo={[
                  d.tipo_destino === 'COMERCIO'
                    ? `Comercio: ${d.denunciado.comercio?.nombreFantasia ?? nombreCompleto(d.denunciado)}`
                    : `Cliente: ${nombreCompleto(d.denunciado)}`,
                  d.tipo_destino === 'COMERCIO'
                    ? `Cliente: ${nombreCompleto(d.emisor)}`
                    : `Comercio: ${d.emisor.comercio?.nombreFantasia ?? nombreCompleto(d.emisor)}`,
                  formatFechaLarga(d.fecha_reporte),
                ]
                  .filter(Boolean)
                  .join(' · ')}
                estado={<Badge tone={badge.tone}>{badge.label}</Badge>}
                detalle={
                  <AdminRows
                    rows={[
                      { label: 'Importe del pedido', value: pedido ? formatPesos(pedido.total) : '—' },
                      { label: 'Artículos', value: articulos },
                      {
                        label: 'Forma de pago',
                        value: pedido
                          ? (FORMA_PAGO[pedido.formaPago] ?? pedido.formaPago)
                          : '—',
                      },
                      {
                        label: 'Estado del pedido',
                        value: pedido ? (ESTADO_PEDIDO[pedido.estado] ?? pedido.estado) : '—',
                      },
                      {
                        label: 'Denunciante',
                        value: `${nombreCompleto(d.emisor)} (${d.tipo_destino === 'COMERCIO' ? 'cliente' : 'comercio'})`,
                      },
                      {
                        label: 'Denunciado',
                        value: `${nombreCompleto(d.denunciado)} (${d.tipo_destino === 'COMERCIO' ? 'comercio' : 'cliente'})`,
                      },
                      {
                        label: 'Estado de la cuenta denunciada',
                        value: ESTADO_CUENTA[d.denunciado.estado],
                      },
                      {
                        label:
                          d.tipo_destino === 'COMERCIO'
                            ? 'Registro del comercio'
                            : 'Registro del usuario',
                        value:
                          d.tipo_destino === 'COMERCIO'
                            ? 'Verificado'
                            : `${d.registro.total} denuncia(s) recibida(s) · ${d.registro.abiertas} abierta(s) · ${d.registro.resueltas} resuelta(s) · ${d.registro.desestimadas} desestimada(s)`,
                      },
                      ...(d.denunciado.comercio
                        ? [
                            {
                              label: 'CUIT / Razón social',
                              value: `${d.denunciado.comercio.cuit} · ${d.denunciado.comercio.razonSocial}`,
                            },
                          ]
                        : []),
                      { label: 'Descripción', value: d.descripcion ? `"${d.descripcion}"` : 'Sin descripción' },
                      ...(d.admin
                        ? [{ label: 'Resuelta por', value: nombreCompleto(d.admin) }]
                        : []),
                    ]}
                  />
                }
                acciones={
                  abierta || suspendido ? (
                    <>
                      {abierta && (
                        <>
                          <Button
                            variant="default"
                            className="btn-compact"
                            loading={ocupado}
                            disabled={bloqueado && !ocupado}
                            onClick={() => void ejecutar(d, 'investigacion')}
                          >
                            {d.estado_reporte === 'BAJO_INVESTIGACION'
                              ? 'Cerrar investigación'
                              : 'Abrir investigación'}
                          </Button>
                          <Button
                            variant="subtle"
                            className="btn-compact"
                            disabled={bloqueado}
                            onClick={() => void ejecutar(d, 'resolver')}
                          >
                            Marcar resuelto
                          </Button>
                          <Button
                            color="red"
                            className="btn-danger btn-compact"
                            disabled={bloqueado}
                            onClick={() => setSancionando(d)}
                          >
                            Sancionar
                          </Button>
                        </>
                      )}
                      {suspendido && (
                        <Button
                          variant="default"
                          className="btn-compact"
                          loading={ocupado}
                          disabled={bloqueado && !ocupado}
                          onClick={() => setRehabilitando(d)}
                        >
                          Rehabilitar cuenta
                        </Button>
                      )}
                    </>
                  ) : undefined
                }
              />
            );
          })}
        </AdminLista>
      )}

      <ConfirmDialog
        open={sancionando !== null}
        danger
        title="Sancionar cuenta"
        confirmLabel="Suspender cuenta"
        loading={procesando !== null}
        onClose={() => setSancionando(null)}
        onConfirm={() => sancionando && void ejecutar(sancionando, 'sancionar')}
      >
        La cuenta de <strong>{sancionando ? nombreCompleto(sancionando.denunciado) : ''}</strong>{' '}
        pasará a <strong>SUSPENDIDO</strong>, se cerrarán sus sesiones y se le notificará por
        correo. También se cerrarán las demás denuncias abiertas del mismo usuario. La
        resolución del conflicto es externa: el sistema solo actualiza el estado.
      </ConfirmDialog>

      <ConfirmDialog
        open={rehabilitando !== null}
        title="Rehabilitar cuenta"
        confirmLabel="Rehabilitar cuenta"
        loading={procesando !== null}
        onClose={() => setRehabilitando(null)}
        onConfirm={() => rehabilitando && void ejecutar(rehabilitando, 'rehabilitar')}
      >
        La cuenta de{' '}
        <strong>{rehabilitando ? nombreCompleto(rehabilitando.denunciado) : ''}</strong> volverá a
        estado <strong>HABILITADO</strong>. Si es comerciante, su comercio también se reactiva.
      </ConfirmDialog>
    </>
  );
}