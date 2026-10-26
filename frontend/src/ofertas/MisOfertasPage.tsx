import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/contexto';

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
  estado: 'ACTIVO' | 'PAUSADO' | 'VENCIDO_ELIMINADO' | 'ELIMINADO';
};

class OfferRequestError extends Error {
  readonly status: number;

  constructor(
    message: string,
    status: number,
  ) {
    super(message);
    this.name = 'OfferRequestError';
    this.status = status;
  }
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

    throw new OfferRequestError(message, response.status);
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
  const missingSession =
  usuario?.rol === 'COMERCIANTE' && !token;

  useEffect(() => {
    if (usuario?.rol !== 'COMERCIANTE' || !token) return;

    let active = true;

    void requestOffers<Offer[]>('/offers', token)
      .then((result) => {
        if (active) setOffers(result);
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
        if (active) setLoading(false);
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
    const image = formData.get('imagen');

    if (image instanceof File && image.size === 0) {
      formData.delete('imagen');
    }

    setSavingId(offer.id);

    try {
      const updatedOffer = await requestOffers<Offer>(
        `/offers/${offer.id}`,
        token,
        {
          method: 'PATCH',
          body: formData,
        },
      );

      setOffers((currentOffers) =>
        currentOffers.map((currentOffer) =>
          currentOffer.id === offer.id ? updatedOffer : currentOffer,
        ),
      );
      setSuccessMessage('Oferta actualizada correctamente.');
    } catch (error: unknown) {
      if (error instanceof OfferRequestError && error.status === 503) {
        const stockInput = form.elements.namedItem('stock');

        if (stockInput instanceof HTMLInputElement) {
          stockInput.value = String(offer.stock);
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

  if (usuario?.rol !== 'COMERCIANTE') {
    return (
      <main>
        <h1>Mis Ofertas</h1>
        <p role="alert">Esta sección está disponible para comerciantes.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Mis Ofertas</h1>
      <p>
        <Link to="/ofertas/nueva">Publicar una oferta</Link>
      </p>

      {loading && !missingSession && (
        <p role="status">Cargando tus ofertas…</p>
      )}

      {missingSession && (
        <p role="alert">
          No se encontró una sesión válida. Iniciá sesión nuevamente.
        </p>
      )}

      {loadingError && <p role="alert">{loadingError}</p>}
      {saveError && <p role="alert">{saveError}</p>}
      {successMessage && <p role="status">{successMessage}</p>}
      
        {loadingError && !loading && (
        <button
        type="button"
        onClick={() => setReloadCount((count) => count + 1)}
        >
        Reintentar
        </button>
        )}

      {!loading && !loadingError && offers.length === 0 && (
        <p>Todavía no publicaste ofertas.</p>
      )}

      <section aria-label="Listado de mis ofertas">
        {offers.map((offer) => (
          <article key={offer.id}>
            <h2>{offer.titulo}</h2>
            <p>{offer.descripcion}</p>
            <p>Estado: {offer.estado}</p>
            <img
                src={new URL(offer.imagen, API_URL).toString()}
                alt={`Imagen de ${offer.titulo}`}
                loading="lazy"
                width={240}
                height={180}
                style={{ objectFit: 'contain' }}
            />

            <form
              key={`${offer.id}-${offer.precioLista}-${offer.precioMenorcost}-${offer.stock}-${offer.imagen}`}
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

              <button type="submit" disabled={savingId === offer.id}>
                {savingId === offer.id ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </form>
          </article>
        ))}
      </section>
    </main>
  );
}