import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/contexto';

type OfferStatus =
  | 'ACTIVO'
  | 'PAUSADO'
  | 'VENCIDO_ELIMINADO'
  | 'ELIMINADO';

type Offer = {
  id: string;
  comercioId: string;
  categoriaId: string;
  tipo: 'INDIVIDUAL' | 'COMBO';
  titulo: string;
  descripcion: string;
  fechaVencimiento: string;
  stock: number;
  precioLista: string;
  precioMenorcost: string;
  imagen: string;
  estado: OfferStatus;
};

type ManageableOfferStatus = 'ACTIVO' | 'PAUSADO' | 'ELIMINADO';

type OfferDashboardSummary = {
  total: number;
  activas: number;
  pausadas: number;
  proximasAVencer: number;
  vencidas: number;
  sinStock: number;
  unidadesReservadas: number;
};

type OfferFilter =
  | 'TODAS'
  | 'ACTIVO'
  | 'PAUSADO'
  | 'VENCIDO_ELIMINADO'
  | 'ELIMINADO';

class OfferRequestError extends Error {
  readonly status: number;
  readonly minimumStock?: number;

  constructor(message: string, status: number, minimumStock?: number) {
    super(message);
    this.name = 'OfferRequestError';
    this.status = status;
    this.minimumStock = minimumStock;
  }
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

function priceToCents(value: FormDataEntryValue | null): bigint | null {
  if (typeof value !== 'string' || !/^\d+(\.\d{1,2})?$/.test(value)) {
    return null;
  }

  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

function formatDate(date: string): string {
  const parts = date.split('-');

  if (parts.length !== 3) {
    return date;
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

async function requestOffers<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      throw new Error('El servidor devolvió una respuesta inválida.');
    }
  }

  if (!response.ok) {
    let message = `No se pudo completar la solicitud (${response.status}).`;

    if (
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload
    ) {
      const serverMessage = payload.message;

      if (typeof serverMessage === 'string') {
        message = serverMessage;
      } else if (
        Array.isArray(serverMessage) &&
        serverMessage.every((part) => typeof part === 'string')
      ) {
        message = serverMessage.join('. ');
      }
    }

    const minimumStock =
      typeof payload === 'object' &&
      payload !== null &&
      'minimumStock' in payload &&
      typeof payload.minimumStock === 'number' &&
      Number.isInteger(payload.minimumStock) &&
      payload.minimumStock >= 0
        ? payload.minimumStock
        : undefined;

    throw new OfferRequestError(message, response.status, minimumStock);
  }

  return payload as T;
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

  async function handleUpdate(
    event: FormEvent<HTMLFormElement>,
    offer: Offer,
  ) {
    event.preventDefault();
    setSaveError('');
    setSuccessMessage('');

    if (!token) {
      setSaveError('Iniciá sesión para modificar una oferta.');
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const precioLista = priceToCents(formData.get('precioLista'));
    const precioMenorcost = priceToCents(formData.get('precioMenorcost'));

    if (precioLista === null || precioMenorcost === null) {
      setSaveError('Ingresá precios válidos con hasta dos decimales.');
      return;
    }

    if (precioLista <= 0n || precioMenorcost <= 0n) {
      setSaveError('Los precios deben ser mayores que cero.');
      return;
    }

    if (precioMenorcost >= precioLista) {
      setSaveError(
        'El precio promocional debe ser menor que el precio de lista.',
      );
      return;
    }

    const image = formData.get('imagen');

    if (image instanceof File && image.size === 0) {
      formData.delete('imagen');
    } else if (image instanceof File) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      const maxSize = 5 * 1024 * 1024;

      if (!allowedTypes.includes(image.type)) {
        setSaveError('Elegí una imagen JPEG, PNG o WebP.');
        return;
      }

      if (image.size > maxSize) {
        setSaveError('La imagen no puede superar los 5 MB.');
        return;
      }
    }

    setSavingId(offer.id);

    try {
      await requestOffers<Offer>(`/offers/${offer.id}`, token, {
        method: 'PATCH',
        body: formData,
      });

      setSuccessMessage('Oferta actualizada correctamente.');
      reloadOffers();
    } catch (error: unknown) {
      if (error instanceof OfferRequestError) {
        const stockInput = form.elements.namedItem('stock');

        if (stockInput instanceof HTMLInputElement) {
          if (error.status === 400 && error.minimumStock !== undefined) {
            stockInput.value = String(error.minimumStock);
          } else if (error.status === 503) {
            stockInput.value = String(offer.stock);
          }
        }
      }

      setSaveError(
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar la oferta.',
      );
    } finally {
      setSavingId(null);
    }
  }

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
                        <span>Tipo</span>
                        <strong>
                          {offer.tipo === 'COMBO' ? 'Combo' : 'Individual'}
                        </strong>
                      </p>
                      <p>
                        <span>Vencimiento</span>
                        <strong>{formatDate(offer.fechaVencimiento)}</strong>
                      </p>
                      <p>
                        <span>Precio de lista</span>
                        <strong>${offer.precioLista}</strong>
                      </p>
                      <p>
                        <span>Precio promocional</span>
                        <strong>${offer.precioMenorcost}</strong>
                      </p>
                      <p>
                        <span>Stock disponible</span>
                        <strong>{offer.stock}</strong>
                      </p>
                    </div>

                    {isEditable ? (
                      <>
                        <div
                          className="offer-card__actions"
                          aria-label={`Acciones de estado para ${offer.titulo}`}
                        >
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

                        <form
                          key={`${offer.id}-${offer.precioLista}-${offer.precioMenorcost}-${offer.stock}-${offer.imagen}`}
                          className="offer-edit-form"
                          onSubmit={(event) => void handleUpdate(event, offer)}
                        >
                          <label>
                            Precio de lista
                            <input
                              name="precioLista"
                              type="number"
                              min="0.01"
                              step="0.01"
                              defaultValue={offer.precioLista}
                              required
                            />
                          </label>

                          <label>
                            Precio promocional
                            <input
                              name="precioMenorcost"
                              type="number"
                              min="0.01"
                              step="0.01"
                              defaultValue={offer.precioMenorcost}
                              required
                            />
                          </label>

                          <label>
                            Stock
                            <input
                              name="stock"
                              type="number"
                              min="0"
                              step="1"
                              defaultValue={offer.stock}
                              required
                            />
                          </label>

                          <label>
                            Cambiar imagen (opcional)
                            <input
                              name="imagen"
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                            />
                          </label>

                          <button
                            className="chip chip--active"
                            type="submit"
                            disabled={isSaving}
                          >
                            {isSaving ? 'Guardando…' : 'Guardar cambios'}
                          </button>
                        </form>
                      </>
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
    </main>
  );
}