import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { SimuladorPreciosPanel } from './simulador/SimuladorPreciosPanel'
import { useSimuladorPrecios } from './simulador/useSimuladorPrecios'

type Option = {
  id: string
  nombre: string
}

type Props = {
  token: string
  comercios: Option[]
  categorias: Option[]
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

function localDateString() {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  const localDate = new Date(
    tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60_000,
  )

  return localDate.toISOString().slice(0, 10)
}

export function NewOfferForm({ token, comercios, categorias }: Props) {
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [imageError, setImageError] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [precioLista, setPrecioLista] = useState('')
  const [precioBaseNeto, setPrecioBaseNeto] = useState('')
  const {
    resultado: simulacion,
    error: simulacionError,
    cargando: simulando,
  } = useSimuladorPrecios(token, precioLista, precioBaseNeto)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!token) {
      setError('Inicia sesión para publicar una oferta.')
      return
    }

    const form = event.currentTarget
    const data = new FormData(form)

    if (simulando) {
      setError('Esperá a que termine la simulación de precios.')
      return
    }

    if (!simulacion) {
      setError(
        simulacionError ||
          'Ingresá un precio de lista y un precio base neto válidos para simular.',
      )
      return
    }

    if (Number(simulacion.precioPublico) >= Number(precioLista)) {
      setError(
        'El precio promocional debe ofrecer un descuento real respecto al precio de lista original.',
      )
      return
    }

    data.set('precioLista', precioLista)
    data.set('precioMenorcost', simulacion.precioPublico)

    setSubmitting(true)

    try {
      const response = await fetch(`${API_URL}/offers`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: data,
      })

      const result: unknown = await response.json()

      if (!response.ok) {
        const serverMessage =
          typeof result === 'object' &&
          result !== null &&
          'message' in result &&
          typeof result.message === 'string'
            ? result.message
            : 'No se pudo publicar la oferta.'

        throw new Error(serverMessage)
      }

      setMessage('Oferta publicada correctamente.')
      form.reset()
      setPrecioLista('')
      setPrecioBaseNeto('')
      setPreviewUrl(null)
      setImageError('')
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Ocurrió un error inesperado al publicar.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
  return () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
  }
  }, [previewUrl])

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null

    setImageError('')
    setPreviewUrl(null)

    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    const maxSize = 5 * 1024 * 1024

    if (!allowedTypes.includes(file.type)) {
      setImageError('Elige una imagen JPEG, PNG o WebP.')
      event.currentTarget.value = ''
      return
    }

    if (file.size > maxSize) {
      setImageError('La imagen no puede superar los 5 MB.')
      event.currentTarget.value = ''
      return
    }
    setPreviewUrl(URL.createObjectURL(file))
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Modalidad
        <select name="tipo" defaultValue="" required>
          <option value="" disabled>
            Selecciona una modalidad
          </option>
          <option value="INDIVIDUAL">Producto individual</option>
          <option value="COMBO">Canasta / combo ahorro</option>
        </select>
      </label>

      <label>
        Negocio
        <select name="comercioId" defaultValue="" required>
          <option value="" disabled>
            Selecciona un negocio
          </option>
          {comercios.map((comercio) => (
            <option key={comercio.id} value={comercio.id}>
              {comercio.nombre}
            </option>
          ))}
        </select>
      </label>

      <label>
        Categoría
        <select name="categoriaId" defaultValue="" required>
          <option value="" disabled>
            Selecciona una categoría
          </option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nombre}
            </option>
          ))}
        </select>
      </label>

      <label>
        Título
        <input name="titulo" maxLength={120} required />
      </label>

      <label>
        Descripción
        <textarea name="descripcion" maxLength={2000} required />
      </label>

      <label>
        Fecha de vencimiento
        <input
          name="fechaVencimiento"
          type="date"
          min={localDateString()}
          required
        />
      </label>

      <label>
        Stock
        <input name="stock" type="number" min={1} step={1} required />
      </label>

      <label>
        Precio de lista original
        <input
          type="number"
          min="0.01"
          step="0.01"
          inputMode="decimal"
          required
          value={precioLista}
          onChange={(event) => setPrecioLista(event.currentTarget.value)}
        />
      </label>

      <label>
        Precio base neto a cobrar
        <input
          type="number"
          min="0.01"
          step="0.01"
          inputMode="decimal"
          required
          value={precioBaseNeto}
          onChange={(event) => setPrecioBaseNeto(event.currentTarget.value)}
        />
      </label>

      <label>
        Fotografía (JPEG, PNG o WebP; máximo 5 MB)
        <input
          name="imagen"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          onChange={handleImageChange}
        />
      </label>

      {imageError && <p role="alert">{imageError}</p>}

      {previewUrl && (
        <img
          src={previewUrl}
          alt="Vista previa de la oferta"
          width={240}
          height={180}
          style={{ objectFit: 'contain' }}
        />
      )}

      <SimuladorPreciosPanel
        resultado={simulacion}
        error={simulacionError}
        cargando={simulando}
      />

      <button type="submit" disabled={submitting}>
        {submitting ? 'Publicando...' : 'Publicar oferta'}
      </button>

      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </form>
  )
}