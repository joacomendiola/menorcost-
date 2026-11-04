import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../auth/contexto';

type Notification = {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: 'OFERTA_VENCIDA';
  leida: boolean;
  createdAt: string;
};

function formatNotificationDate(value: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function NotificationsBell() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const unreadCount = notifications.filter(
    (notification) => !notification.leida,
  ).length;

  useEffect(() => {
    if (!token) {
      setNotifications([]);
      return;
    }

    let active = true;
    setLoading(true);
    setError('');

    void api<Notification[]>('/notifications', { token })
      .then((result) => {
        if (active) {
          setNotifications(result);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'No se pudieron cargar las notificaciones.',
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  async function markAsRead(notification: Notification): Promise<void> {
    if (notification.leida || !token) {
      return;
    }

    try {
      const updated = await api<Notification>(
        `/notifications/${notification.id}/read`,
        {
          method: 'PATCH',
          token,
        },
      );

      setNotifications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo marcar la notificación como leída.',
      );
    }
  }

  return (
    <div
      style={{
        position: 'relative',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={
          unreadCount > 0
            ? `Notificaciones, ${unreadCount} sin leer`
            : 'Notificaciones'
        }
        aria-expanded={open}
        style={{
          position: 'relative',
          border: '1px solid var(--bd)',
          borderRadius: '50%',
          width: 40,
          height: 40,
          background: 'var(--card)',
          color: 'var(--tx)',
          cursor: 'pointer',
          fontSize: 18,
        }}
      >
        <span aria-hidden="true">🔔</span>
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              padding: '0 4px',
              borderRadius: 999,
              background: 'var(--bad)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              lineHeight: '18px',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          aria-label="Notificaciones"
          style={{
            position: 'absolute',
            top: 48,
            right: 0,
            zIndex: 110,
            width: 340,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 420,
            overflowY: 'auto',
            padding: 12,
            background: 'var(--card)',
            border: '1px solid var(--bd)',
            borderRadius: 14,
            boxShadow: 'var(--shadow-float)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <strong>Notificaciones</strong>
            {unreadCount > 0 && (
              <span style={{ color: 'var(--mut)', fontSize: 12 }}>
                {unreadCount} sin leer
              </span>
            )}
          </div>

          {loading && (
            <p style={{ color: 'var(--mut)', fontSize: 13 }}>
              Cargando notificaciones...
            </p>
          )}

          {error && (
            <p style={{ color: 'var(--bad)', fontSize: 13 }}>{error}</p>
          )}

          {!loading && !error && notifications.length === 0 && (
            <p style={{ color: 'var(--mut)', fontSize: 13 }}>
              No tenés notificaciones nuevas.
            </p>
          )}

          {!loading &&
            !error &&
            notifications.map((notification) => (
              <article
                key={notification.id}
                style={{
                  padding: '10px 0',
                  borderTop: '1px solid var(--bd)',
                  opacity: notification.leida ? 0.7 : 1,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <strong style={{ fontSize: 13 }}>
                    {notification.titulo}
                  </strong>

                  {!notification.leida && (
                    <span
                      style={{
                        color: 'var(--pri)',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      NUEVA
                    </span>
                  )}
                </div>

                <p
                  style={{
                    margin: '5px 0',
                    color: 'var(--mut)',
                    fontSize: 13,
                    lineHeight: 1.4,
                  }}
                >
                  {notification.mensaje}
                </p>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <time
                    dateTime={notification.createdAt}
                    style={{ color: 'var(--mut)', fontSize: 11 }}
                  >
                    {formatNotificationDate(notification.createdAt)}
                  </time>

                  {!notification.leida && (
                    <button
                      type="button"
                      onClick={() => void markAsRead(notification)}
                      style={{
                        border: 0,
                        padding: 0,
                        background: 'transparent',
                        color: 'var(--pri)',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Marcar como leída
                    </button>
                  )}
                </div>
              </article>
            ))}
        </section>
      )}
    </div>
  );
}