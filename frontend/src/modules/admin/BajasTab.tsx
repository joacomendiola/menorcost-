import { useMemo, useState } from 'react';
import { Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { adminApi, type AdminBaja } from '../../api';
import { useAuth } from '../../auth/contexto';
import { Badge, type BadgeTone } from '../../components/ui/Badge';
import { useAdminContext } from './adminContext';
import { useAdminList } from './useAdminList';
import {
  esSesionVencida,
  formatFechaCorta,
  formatPesos,
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
  ConfirmDialog,
  MotivoDialog,
} from './AdminUI';

const ESTADO_BADGE: Record<AdminBaja['estado'], { tone: BadgeTone; label: string }> = {
  PENDIENTE: { tone: 'neutro', label: 'Baja de cuenta' },
  APROBADA: { tone: 'ok', label: 'Baja aprobada' },
  RECHAZADA: { tone: 'bad', label: 'Baja rechazada' },
};

type Accion = { tipo: 'aprobar' | 'rechazar'; baja: AdminBaja };

export function BajasTab() {
  const { token, cerrarSesion } = useAuth();
  const { search, estado, refrescarKpis } = useAdminContext();
  const { items, cargando, error, recargar } = useAdminList<AdminBaja>(
    (t) => adminApi.bajas(t, { estado }),
    [estado],
  );

  const [accion, setAccion] = useState<Accion | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  // El backend no filtra bajas por texto: se filtra en cliente.
  const visibles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(({ usuario: u }) =>
      [
        u.nombre,
        u.apellido,
        u.email,
        u.dni,
        u.comercio?.cuit,
        u.comercio?.razonSocial,
        u.comercio?.nombreFantasia,
      ].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [items, search]);

  async function confirmar(observaciones?: string) {
    if (!accion || !token) return;
    const { tipo, baja } = accion;
    setProcesando(true);
    try {
      if (tipo === 'aprobar') {
        await adminApi.aprobarBaja(token, baja.id);
        setResultado(
          `Baja aprobada: la cuenta de ${nombreCompleto(baja.usuario)} fue dada de baja (borrado lógico) y sus sesiones se cerraron.`,
        );
      } else {
        await adminApi.rechazarBaja(token, baja.id, observaciones || undefined);
        setResultado(
          `Baja rechazada: la cuenta de ${nombreCompleto(baja.usuario)} sigue activa.`,
        );
      }
      setAccion(null);
      refrescarKpis();
      await recargar();
    } catch (err) {
      if (esSesionVencida(err)) {
        cerrarSesion();
        return;
      }
      notifications.show({ message: mensajeError(err), color: 'bad' });
      setAccion(null);
      void recargar();
    } finally {
      setProcesando(false);
    }
  }

  return (
    <>
      {resultado && <AdminResult>{resultado}</AdminResult>}

      {cargando && items.length === 0 ? (
        <AdminSkeleton />
      ) : error ? (
        <AdminEmpty>
          {error}{' '}
          <button type="button" className="link-button" onClick={() => void recargar()}>
            Reintentar
          </button>
        </AdminEmpty>
      ) : visibles.length === 0 ? (
        <AdminEmpty>
          {estado === 'PENDIENTE' ? 'No hay bajas pendientes.' : 'No hay bajas para mostrar.'}
        </AdminEmpty>
      ) : (
        <AdminLista>
          {visibles.map((baja, idx) => {
            const u = baja.usuario;
            const badge = ESTADO_BADGE[baja.estado];
            const pendiente = baja.estado === 'PENDIENTE';

            return (
              <AdminItem
                key={baja.id}
                defaultOpen={idx === 0}
                avatar={iniciales(u.nombre, u.apellido)}
                titulo={nombreCompleto(u)}
                subtitulo={`Motivo: "${baja.motivo}". Solicitado ${formatFechaCorta(baja.createdAt)}`}
                estado={<Badge tone={badge.tone}>{badge.label}</Badge>}
                detalle={
                  <AdminRows
                    rows={[
                      { label: 'DNI', value: u.dni },
                      { label: 'Correo', value: u.email },
                      { label: 'Contacto', value: u.telefono ?? '—' },
                      { label: 'Tipo de cuenta', value: u.rol === 'COMERCIANTE' ? 'Comerciante' : 'Cliente' },
                      { label: 'Pedidos completados', value: String(baja.pedidosCompletados) },
                      {
                        label: 'Saldo de tarifas',
                        value:
                          baja.saldoTarifas === 0
                            ? '$0 (sin deudas)'
                            : formatPesos(baja.saldoTarifas),
                      },
                      ...(u.comercio
                        ? [
                            { label: 'Razón social', value: u.comercio.razonSocial },
                            { label: 'CUIT', value: u.comercio.cuit },
                          ]
                        : []),
                      {
                        label: 'Cuenta activa desde',
                        value: u.createdAt ? formatFechaCorta(u.createdAt) : '—',
                      },
                      ...(baja.resueltoEn
                        ? [{ label: 'Resuelta', value: formatFechaCorta(baja.resueltoEn) }]
                        : []),
                      ...(baja.observaciones
                        ? [{ label: 'Observaciones', value: baja.observaciones }]
                        : []),
                    ]}
                  />
                }
                acciones={
                  pendiente ? (
                    <>
                      <Button
                        color="red"
                        className="btn-danger btn-compact"
                        onClick={() => setAccion({ tipo: 'rechazar', baja })}
                      >
                        Rechazar baja
                      </Button>
                      <Button
                        color="mint"
                        className="btn-mint btn-compact"
                        onClick={() => setAccion({ tipo: 'aprobar', baja })}
                      >
                        ✓ Aprobar baja
                      </Button>
                    </>
                  ) : undefined
                }
              />
            );
          })}
        </AdminLista>
      )}

      <ConfirmDialog
        open={accion?.tipo === 'aprobar'}
        title="Aprobar baja de cuenta"
        confirmLabel="Aprobar baja"
        loading={procesando}
        onClose={() => setAccion(null)}
        onConfirm={() => void confirmar()}
      >
        Se ejecutará el borrado lógico de la cuenta de{' '}
        <strong>{accion ? nombreCompleto(accion.baja.usuario) : ''}</strong> y se cerrarán sus
        sesiones. El sistema verifica que no existan pedidos con pago o retiro pendiente ni
        denuncias abiertas; si los hay, la baja no se aplica.
      </ConfirmDialog>

      <MotivoDialog
        open={accion?.tipo === 'rechazar'}
        danger
        required={false}
        title="Rechazar baja de cuenta"
        label="Observaciones (opcional)"
        placeholder="Ej.: Tiene un pedido pendiente de retiro."
        confirmLabel="Rechazar baja"
        loading={procesando}
        onClose={() => setAccion(null)}
        onConfirm={(obs) => void confirmar(obs)}
      />
    </>
  );
}