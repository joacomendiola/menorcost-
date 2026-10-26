import { useState } from 'react';
import { Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { adminApi, type AdminAlta, type EstadoUsuario } from '../../api';
import { useAuth } from '../../auth/contexto';
import { Badge, type BadgeTone } from '../../components/ui/Badge';
import { useAdminContext } from './adminContext';
import { useAdminList } from './useAdminList';
import {
  esSesionVencida,
  formatFechaCorta,
  iniciales,
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
  MotivoDialog,
} from './AdminUI';

const ESTADO_BADGE: Partial<Record<EstadoUsuario, { tone: BadgeTone; label: string }>> = {
  PENDIENTE_VERIFICACION: { tone: 'pend', label: 'Pendiente de verificación' },
  HABILITADO: { tone: 'ok', label: 'Habilitado' },
  DOCUMENTACION_RECHAZADA: { tone: 'bad', label: 'Documentación rechazada' },
  SUSPENDIDO: { tone: 'bad', label: 'Suspendido' },
  BAJO_INVESTIGACION: { tone: 'bad', label: 'Bajo investigación' },
  SOLICITUD_BAJA_PENDIENTE: { tone: 'neutro', label: 'Baja solicitada' },
};

interface Resultado {
  tone: 'ok' | 'warn';
  texto: string;
}

export function AltasTab() {
  const { token, cerrarSesion } = useAuth();
  const { search, estado, refrescarKpis } = useAdminContext();
  const { items, cargando, error, recargar } = useAdminList<AdminAlta>(
    (t) => adminApi.altas(t, { search, estado }),
    [search, estado],
  );

  const [procesando, setProcesando] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState<AdminAlta | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  async function ejecutar(alta: AdminAlta, accion: 'aprobar' | 'rechazar', motivo?: string) {
    if (!token) return;
    setProcesando(alta.idComercio);
    try {
      const resp =
        accion === 'aprobar'
          ? await adminApi.aprobarAlta(token, alta.idComercio)
          : await adminApi.rechazarAlta(token, alta.idComercio, motivo ?? '');

      const nombre = nombreCompleto(alta.usuario);
      const base =
        accion === 'aprobar'
          ? `${nombre} pasó a HABILITADO. Se envió el correo de bienvenida.`
          : `${nombre} pasó a DOCUMENTACION_RECHAZADA. Se notificó el motivo por correo.`;

      if (resp.notificacion.enviada) {
        setResultado({ tone: 'ok', texto: base });
      } else {
        setResultado({
          tone: 'warn',
          texto: `${nombre}: ${resp.notificacion.aviso ?? 'No se pudo enviar el correo de notificación.'}`,
        });
      }
      setRechazando(null);
      refrescarKpis();
      await recargar();
    } catch (err) {
      if (esSesionVencida(err)) {
        cerrarSesion();
        return;
      }
      notifications.show({ message: mensajeError(err), color: 'bad' });
      // Si otro admin ya la procesó, refrescamos para mostrar el estado real.
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
          {estado === 'PENDIENTE_VERIFICACION'
            ? 'No hay solicitudes de alta pendientes.'
            : 'No hay solicitudes de alta para mostrar.'}
        </AdminEmpty>
      ) : (
        <AdminLista>
          {items.map((alta, idx) => {
            const u = alta.usuario;
            const pendiente = u.estado === 'PENDIENTE_VERIFICACION';
            const dir = u.direcciones.find((d) => d.esPredeterminada) ?? u.direcciones[0];
            const estadoBadge = ESTADO_BADGE[u.estado];
            const ocupado = procesando === alta.idComercio;

            return (
              <AdminItem
                key={alta.idComercio}
                defaultOpen={idx === 0}
                avatar={iniciales(u.nombre, u.apellido)}
                titulo={nombreCompleto(u)}
                badges={
                  <>
                    {estadoBadge && <Badge tone={estadoBadge.tone}>{estadoBadge.label}</Badge>}
                    <Badge tone={dir ? 'neutro' : 'pend'}>
                      {dir ? 'Georref. completa' : 'Sin ubicación'}
                    </Badge>
                    <Badge tone={alta.mercadoPagoVinculado ? 'blue' : 'neutro'}>
                      {alta.mercadoPagoVinculado ? 'Mercado Pago vinculado' : 'Mercado Pago sin vincular'}
                    </Badge>
                  </>
                }
                subtitulo={`DNI ${u.dni} · Solicitado ${formatFechaCorta(u.createdAt)}`}
                detalle={
                  <AdminRows
                    rows={[
                      {
                        label: 'Dirección del local',
                        value: dir
                          ? `${dir.calle} ${dir.numero}${dir.piso ? `, piso ${dir.piso}` : ''}, ${dir.localidad}`
                          : 'Sin dirección cargada',
                      },
                      {
                        label: 'Georreferenciación',
                        value: dir ? (
                          <span className="admin-mono">
                            {Number(dir.latitud).toFixed(5)}, {Number(dir.longitud).toFixed(5)}
                          </span>
                        ) : (
                          '—'
                        ),
                      },
                      { label: 'Correo (para la documentación)', value: u.email },
                      { label: 'Contacto', value: u.telefono ?? '—' },
                      {
                        label: 'Reputación',
                        value:
                          alta.totalCalificaciones > 0
                            ? `${alta.reputacionPromedio.toFixed(1)} ★ (${alta.totalCalificaciones})`
                            : 'Sin calificaciones',
                      },
                    ]}
                  />
                }
                acciones={
                  pendiente ? (
                    <>
                      <Button
                        className="btn-mint btn-compact"
                        color="mint"
                        loading={ocupado}
                        disabled={procesando !== null && !ocupado}
                        onClick={() => void ejecutar(alta, 'aprobar')}
                      >
                        ✓ Aprobar alta
                      </Button>
                      <Button
                        variant="subtle"
                        color="gray"
                        className="btn-compact"
                        disabled={procesando !== null}
                        onClick={() => setRechazando(alta)}
                      >
                        Rechazar
                      </Button>
                    </>
                  ) : undefined
                }
              />
            );
          })}
        </AdminLista>
      )}

      <MotivoDialog
        open={rechazando !== null}
        danger
        title="Rechazar solicitud de alta"
        label="Motivo del rechazo"
        placeholder="Ej.: La constancia de CUIT no coincide con la razón social."
        confirmLabel="Rechazar alta"
        loading={procesando !== null}
        onClose={() => setRechazando(null)}
        onConfirm={(motivo) => rechazando && void ejecutar(rechazando, 'rechazar', motivo)}
      />
    </>
  );
}