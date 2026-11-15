import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/contexto';
import { EditarOfertaModal } from './EditarOfertaModal';
import {
  API_URL,
  OfferRequestError,
  requestOffers,
  type ManageableOfferStatus,
  type Offer,
  type OfferDashboardSummary,
  type OfferStatus,
} from './ofertasApi';

type OfferFilter =
  | 'TODAS'
  | 'ACTIVO'
  | 'PAUSADO'
  | 'VENCIDO_ELIMINADO'
  | 'ELIMINADO';

const statusLabels: Record<OfferStatus, string> = {
  ACTIVO: 'Activa',
  PAUSADO: 'Pausada',
  VENCIDO_ELIMINADO: 'Vencida',
  ELIMINADO: 'Dada de baja',
};

const statusClasses: Record<OfferStatus, string> = {
  ACTIVO: 'badge badge--ok',
  PAUSADO: 'badge badge--pend',
  VENCIDO_ELIMINADO: 'badge badge--bad',
  ELIMINADO: 'badge',
};

const offerFilters: { value: OfferFilter; label: string }[] = [
  { value: 'TODAS', label: 'Todas' },
  { value: 'ACTIVO', label: 'Activas' },
  { value: 'PAUSADO', label: 'Pausadas' },
  { value: 'VENCIDO_ELIMINADO', label: 'Vencidas' },
  { value: 'ELIMINADO', label: 'Dadas de baja' },
];

function formatDate(date: string): string {
  const parts = date.split('-');

  if (parts.length !== 3) {
    return date;
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function MisOfertasPage() {
  const { usuario, token } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [reloadCount, setReloadCount] = useState(0);
  const [summary, setSummary] = useState<OfferDashboardSummary | null>(null);
  const [summaryError, setSummaryError] = useState('');
  const [filter, setFilter] = useState<OfferFilter>('TODAS');
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const missingSession = usuario?.rol === 'COMERCIANTE' && !token;

  function reloadOffers() {
    setLoading(true);
    setLoadingError('');
    setSummary(null);
    setSummaryError('');
    setReloadCount((count) => count + 1);
    }
  useEffect(() => {
    if (usuario?.rol !== 'COMERCIANTE' || !token) {
      return;
    }

    let active = true;

    void requestOffers<Offer[]>('/offers', token)
      .then((result) => {
        if (active) {
          setOffers(result);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadingError(
            error instanceof Error
              ? error.message
              : 'No se pudieron cargar tus ofertas.',
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    void requestOffers<OfferDashboardSummary>(
      '/offers/dashboard-summary',
      token,
    )
      .then((result) => {
        if (active) {
          setSummary(result);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setSummaryError(
            error instanceof Error
              ? error.message
              : 'No se pudieron cargar las métricas del inventario.',
          );
        }
      });

    return () => {
      active = false;
    };
  }, [token, usuario?.rol, reloadCount]);

  async function handleStatusChange(
    offer: Offer,
    estado: ManageableOfferStatus,
  ) {
    setSaveError('');
    setSuccessMessage('');

    if (!token) {
      setSaveError('Iniciá sesión para cambiar el estado de una oferta.');
      return;
    }

    if (estado === 'ELIMINADO') {
      const confirmed = window.confirm(
        `¿Confirmás la baja de "${offer.titulo}"? La oferta se marcará como eliminada. Si tiene reservas pendientes, el sistema la pausará y no permitirá darla de baja.`,
      );

      if (!confirmed) {
        return;
      }
    }

    setSavingId(offer.id);

    try {
      await requestOffers<Offer>(`/offers/${offer.id}/status`, token, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ estado }),
      });

      const messages: Record<ManageableOfferStatus, string> = {
        ACTIVO: 'Oferta reactivada correctamente.',
        PAUSADO: 'Oferta pausada correctamente.',
        ELIMINADO: 'Oferta dada de baja correctamente.',
      };
      setSuccessMessage(messages[estado]);
      reloadOffers();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo cambiar el estado de la oferta.';

      if (
        estado === 'ELIMINADO' &&
        error instanceof OfferRequestError &&
        error.status === 409
      ) {
        reloadOffers();
      }

      setSaveError(message);
    } finally {
      setSavingId(null);
    }
  }

  const filteredOffers =
    filter === 'TODAS'
      ? offers
      : offers.filter((offer) => offer.estado === filter);

  function countForFilter(value: OfferFilter): number {
    return value === 'TODAS'
      ? offers.length
      : offers.filter((offer) => offer.estado === value).length;
  }

  const summaryMetrics = summary
    ? [
        { label: 'Total de ofertas', value: summary.total },
        { label: 'Activas', value: summary.activas },
        { label: 'Pausadas', value: summary.pausadas },
        { label: 'Vencen en 7 días', value: summary.proximasAVencer },
        { label: 'Vencidas', value: summary.vencidas },
        { label: 'Sin stock', value: summary.sinStock },
        { label: 'Unidades reservadas', value: summary.unidadesReservadas },
      ]
    : [];

  if (usuario?.rol !== 'COMERCIANTE') {
    return (
      <main className="offers-page">
        <h1>Mis Ofertas</h1>
        <p role="alert">Esta sección está disponible para comerciantes.</p>
      </main>
    );
  }

  return (
    <main className="offers-page">
      <header className="offers-hero">
        <div>
          <h1>Panel de control</h1>
          <p>Gestioná tus publicaciones, precios y stock.</p>
        </div>

        <div className="offers-hero__actions">
          <Link className="offers-hero__create" to="/ofertas/nueva">
            + Crear oferta
          </Link>
        </div>
      </header>

      {missingSession && (
        <p className="offers-feedback" role="alert">
          No se encontró una sesión válida. Iniciá sesión nuevamente.
        </p>
      )}

      {loadingError && (
        <div className="offers-feedback" role="alert">
          <p>{loadingError}</p>
          {token && (
            <button
              className="chip"
              type="button"
              onClick={() => reloadOffers()}
            >
              Reintentar
            </button>
          )}
        </div>
      )}

      {saveError && (
        <p className="offers-feedback" role="alert">
          {saveError}
        </p>
      )}

      {successMessage && (
        <p className="offers-feedback" role="status">
          {successMessage}
        </p>
      )}

      <section aria-label="Resumen del inventario">
        <h2>Resumen del inventario</h2>

        {summaryError && (
          <div className="offers-feedback" role="alert">
            <p>{summaryError}</p>
            {token && (
              <button
                className="chip"
                type="button"
                onClick={() => reloadOffers()}
              >
                Reintentar métricas
              </button>
            )}
          </div>
        )}

        {!summary && !summaryError && !missingSession && (
          <p role="status">Cargando métricas del inventario…</p>
        )}

        {summary && (
          <div className="offers-summary">
            {summaryMetrics.map(({ label, value }) => (
              <article
                key={label}
                className="card offers-summary__card"
              >
                <strong className="offers-summary__value">{value}</strong>
                <span className="offers-summary__label">{label}</span>
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Listado de mis ofertas">
        <nav className="offers-filters" aria-label="Filtrar ofertas por estado">
          {offerFilters.map(({ value, label }) => (
            <button
              key={value}
              className={`chip${filter === value ? ' chip--active' : ''}`}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label} <span>({countForFilter(value)})</span>
            </button>
          ))}
        </nav>

        {loading && <p role="status">Cargando tus ofertas…</p>}

        {!loading && !loadingError && offers.length === 0 && (
          <div className="card offers-empty">
            <h2>Todavía no publicaste ofertas</h2>
            <p>Creá tu primera publicación para empezar a gestionar tu inventario.</p>
            <Link className="offers-hero__create" to="/ofertas/nueva">
              Crear oferta
            </Link>
          </div>
        )}

        {!loading &&
          !loadingError &&
          offers.length > 0 &&
          filteredOffers.length === 0 && (
            <div className="card offers-empty">
              <h2>No hay ofertas en este filtro</h2>
              <button
                className="chip"
                type="button"
                onClick={() => setFilter('TODAS')}
              >
                Ver todas
              </button>
            </div>
          )}

        {filteredOffers.length > 0 && (
          <div className="offers-grid">
            {filteredOffers.map((offer) => {
              const isEditable =
                offer.estado === 'ACTIVO' || offer.estado === 'PAUSADO';
              const isSaving = savingId === offer.id;

              return (
                <article key={offer.id} className="card offer-card">
                  <div className="offer-card__image">
                    <img
                      src={new URL(offer.imagen, API_URL).toString()}
                      alt={`Imagen de ${offer.titulo}`}
                      loading="lazy"
                      width={320}
                      height={220}
                    />
                  </div>

                  <div className="offer-card__body">
                    <div className="offer-card__heading">
                      <h2>{offer.titulo}</h2>
                      <span className={statusClasses[offer.estado]}>
                        {statusLabels[offer.estado]}
                      </span>
                    </div>

                    <p>{offer.descripcion}</p>

                    <div className="offer-card__details">
                      <p>
                        <span>Vencimiento</span>
                        <strong>{formatDate(offer.fechaVencimiento)}</strong>
                      </p>
                      <p>
                        <span>Precio de lista</span>
                        <strong>${offer.precioLista}</strong>
                      </p>
                      <p>
                        <span>Precio final al público</span>
                        <strong>${offer.precioPublico}</strong>
                      </p>
                      <p>
                        <span>Stock disponible</span>
                        <strong>{offer.stock}</strong>
                      </p>
                    </div>

                    {isEditable ? (
                      <div
                        className="offer-card__actions"
                        aria-label={`Acciones para ${offer.titulo}`}
                      >
                        <button
                          className="chip chip--active"
                          type="button"
                          disabled={isSaving}
                          onClick={() => {
                            setSaveError('');
                            setSuccessMessage('');
                            setEditingOffer(offer);
                          }}
                        >
                          Editar oferta
                        </button>

                        {offer.estado === 'ACTIVO' && (
                          <button
                            className="chip"
                            type="button"
                            disabled={isSaving}
                            onClick={() =>
                              void handleStatusChange(offer, 'PAUSADO')
                            }
                          >
                            {isSaving ? 'Procesando…' : 'Pausar oferta'}
                          </button>
                        )}

                        {offer.estado === 'PAUSADO' && (
                          <button
                            className="chip"
                            type="button"
                            disabled={isSaving}
                            onClick={() =>
                              void handleStatusChange(offer, 'ACTIVO')
                            }
                          >
                            {isSaving ? 'Procesando…' : 'Reactivar oferta'}
                          </button>
                        )}

                        <button
                          className="chip chip--danger"
                          type="button"
                          disabled={isSaving}
                          onClick={() =>
                            void handleStatusChange(offer, 'ELIMINADO')
                          }
                        >
                          {isSaving ? 'Procesando…' : 'Dar de baja'}
                        </button>
                      </div>
                    ) : (
                      <p>Esta oferta ya no puede modificarse.</p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {editingOffer && (
        <EditarOfertaModal
          key={editingOffer.id}
          offer={editingOffer}
          opened
          token={token ?? ''}
          onClose={() => setEditingOffer(null)}
          onSaved={() => {
            setEditingOffer(null);
            setSaveError('');
            setSuccessMessage('Oferta actualizada correctamente.');
            reloadOffers();
          }}
        />
      )}
    </main>
  );
}
