import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  FileButton,
  Group,
  Image,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { SimuladorPreciosPanel } from './simulador/SimuladorPreciosPanel';
import { useSimuladorPrecios } from './simulador/useSimuladorPrecios';
import {
  API_URL,
  fechaActualArgentina,
  OfferRequestError,
  priceToCents,
  requestOffers,
  type Offer,
} from './ofertasApi';

type Props = {
  offer: Offer;
  opened: boolean;
  token: string;
  onClose: () => void;
  onSaved: () => void;
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function esFechaValida(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function fechaMananaArgentina(): string {
  return fechaActualArgentina(new Date(Date.now() + 86_400_000));
}

function formatearTasa(tasa: string): string {
  return `${(Number(tasa) * 100).toLocaleString('es-AR', {
    maximumFractionDigits: 2,
  })}%`;
}

function mismosCents(actual: bigint | null, original: bigint | null): boolean {
  return actual !== null && original !== null && actual === original;
}

export function EditarOfertaModal({
  offer,
  opened,
  token,
  onClose,
  onSaved,
}: Props) {
  const [precioLista, setPrecioLista] = useState(offer.precioLista);
  const [precioBaseNeto, setPrecioBaseNeto] = useState(offer.precioBaseNeto);
  const [stock, setStock] = useState(String(offer.stock));
  const [fechaVencimiento, setFechaVencimiento] = useState(
    offer.fechaVencimiento,
  );
  const [archivo, setArchivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState('');
  const [error, setError] = useState('');
  const [stockMinimo, setStockMinimo] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    resultado: simulacion,
    error: simulacionError,
    cargando: simulando,
  } = useSimuladorPrecios(token, precioLista, precioBaseNeto);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const listaCents = priceToCents(precioLista.trim());
  const baseCents = priceToCents(precioBaseNeto.trim());
  const listaOriginal = priceToCents(offer.precioLista);
  const baseOriginal = priceToCents(offer.precioBaseNeto);

  const precioListaModificado = !mismosCents(listaCents, listaOriginal);
  const precioBaseModificado = !mismosCents(baseCents, baseOriginal);
  const preciosModificados = precioListaModificado || precioBaseModificado;

  const tasaCambio =
    simulacion !== null &&
    Number(simulacion.comisionMenorcostTasa) !==
      Number(offer.comisionMenorcostTasaAplicada);

  function handleImageChange(file: File | null) {
    setImageError('');
    setArchivo(null);
    setPreviewUrl(null);

    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError('Elegí una imagen JPEG, PNG o WebP.');
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setImageError('La imagen no puede superar los 5 MB.');
      return;
    }

    setArchivo(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleClose() {
    if (submitting) return;
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setStockMinimo(null);

    if (!token) {
      setError('Iniciá sesión para modificar una oferta.');
      return;
    }

    if (!precioListaModificado && !precioBaseModificado) {
      const listaValida = listaCents !== null && listaCents > 0n;
      const baseValida = baseCents !== null && baseCents > 0n;

      if (!listaValida || !baseValida) {
        setError('Ingresá precios válidos, mayores que cero y con hasta dos decimales.');
        return;
      }
    } else {
      if (precioListaModificado && (listaCents === null || listaCents <= 0n)) {
        setError('El precio de lista debe ser mayor que cero y tener hasta dos decimales.');
        return;
      }

      if (precioBaseModificado && (baseCents === null || baseCents <= 0n)) {
        setError('El precio base neto debe ser mayor que cero y tener hasta dos decimales.');
        return;
      }
    }

    const stockNumero = Number(stock);

    if (!Number.isInteger(stockNumero) || stockNumero < 0) {
      setError('El stock debe ser un número entero mayor o igual a 0.');
      return;
    }

    if (!esFechaValida(fechaVencimiento)) {
      setError('Ingresá una fecha de vencimiento válida.');
      return;
    }

    if (fechaVencimiento <= fechaActualArgentina()) {
      setError('La fecha de vencimiento debe ser posterior a hoy.');
      return;
    }

    if (imageError) {
      setError(imageError);
      return;
    }

    if (simulando) {
      setError('Esperá a que termine la simulación de precios.');
      return;
    }

    if (!simulacion) {
      setError(
        simulacionError ||
          'Ingresá un precio de lista y un precio base neto válidos para simular.',
      );
      return;
    }

    if (Number(simulacion.precioPublico) >= Number(precioLista)) {
      setError(
        'El precio final al público supera el precio de lista. Bajá el precio base neto para ofrecer un descuento real.',
      );
      return;
    }

    const data = new FormData();
    let hayCambios = false;

    if (precioListaModificado) {
      data.set('precioLista', precioLista.trim());
      hayCambios = true;
    }

    if (precioBaseModificado) {
      data.set('precioBaseNeto', simulacion.precioBaseNeto);
      hayCambios = true;
    }

    if (stockNumero !== offer.stock) {
      data.set('stock', String(stockNumero));
      hayCambios = true;
    }

    if (fechaVencimiento !== offer.fechaVencimiento) {
      data.set('fechaVencimiento', fechaVencimiento);
      hayCambios = true;
    }

    if (archivo) {
      data.set('imagen', archivo);
      hayCambios = true;
    }

    if (!hayCambios) {
      setError('No modificaste ningún dato de la oferta.');
      return;
    }

    setSubmitting(true);

    try {
      await requestOffers<Offer>(`/offers/${offer.id}`, token, {
        method: 'PATCH',
        body: data,
      });

      onSaved();
    } catch (submitError: unknown) {
      if (submitError instanceof OfferRequestError) {
        if (
          submitError.status === 400 &&
          submitError.minimumStock !== undefined
        ) {
          setStock(String(submitError.minimumStock));
          setStockMinimo(submitError.minimumStock);
        } else if (submitError.status === 503) {
          setStock(String(offer.stock));
        }
      }

      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No se pudo actualizar la oferta.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  const imagenMostrada = previewUrl ?? new URL(offer.imagen, API_URL).toString();

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Editar oferta"
      centered
      size="lg"
      closeOnClickOutside={!submitting}
      closeOnEscape={!submitting}
    >
      <form onSubmit={(event) => void handleSubmit(event)}>
        <Stack gap="lg">
          <Stack gap={2}>
            <Text fw={700}>{offer.titulo}</Text>
            <Text size="sm" c="dimmed">
              {offer.descripcion}
            </Text>
            <Text size="xs" c="dimmed">
              El título, la descripción y la categoría no se editan desde acá.
            </Text>
          </Stack>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label="Precio de lista original"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              leftSection={
                <Text size="sm" c="dimmed">
                  $
                </Text>
              }
              value={precioLista}
              onChange={(event) => setPrecioLista(event.currentTarget.value)}
              required
            />

            <TextInput
              label="Precio base neto a cobrar"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              leftSection={
                <Text size="sm" c="dimmed">
                  $
                </Text>
              }
              value={precioBaseNeto}
              onChange={(event) => setPrecioBaseNeto(event.currentTarget.value)}
              description="Lo que querés recibir después de las comisiones."
              required
            />

            <TextInput
              label="Stock"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={stock}
              onChange={(event) => setStock(event.currentTarget.value)}
              error={
                stockMinimo !== null
                  ? `Mínimo por unidades reservadas: ${stockMinimo}`
                  : undefined
              }
              required
            />

            <TextInput
              label="Fecha de vencimiento"
              type="date"
              min={fechaMananaArgentina()}
              value={fechaVencimiento}
              onChange={(event) =>
                setFechaVencimiento(event.currentTarget.value)
              }
              description="Debe ser posterior a hoy."
              required
            />
          </SimpleGrid>

          <Box>
            <Text size="sm" fw={600} mb={6}>
              Fotografía
            </Text>

            <Box
              p="md"
              style={{
                border: '1px solid var(--bd)',
                borderRadius: 12,
                background: '#F8FAFC',
              }}
            >
              <Group justify="space-between" gap="md" wrap="wrap">
                <Group gap="sm" wrap="nowrap">
                  <Box
                    w={52}
                    h={52}
                    style={{
                      display: 'grid',
                      placeItems: 'center',
                      overflow: 'hidden',
                      flexShrink: 0,
                      border: '1px solid var(--bd)',
                      borderRadius: 12,
                      background: '#FFFFFF',
                    }}
                  >
                    <Image
                      src={imagenMostrada}
                      alt="Fotografía de la oferta"
                      w={52}
                      h={52}
                      fit="cover"
                    />
                  </Box>

                  <Box>
                    <Text size="sm" fw={600}>
                      {archivo ? archivo.name : 'Foto actual de la oferta'}
                    </Text>
                    <Text size="xs" c="dimmed">
                      JPEG, PNG o WebP · máximo 5 MB
                    </Text>
                  </Box>
                </Group>

                <FileButton
                  onChange={handleImageChange}
                  accept="image/jpeg,image/png,image/webp"
                >
                  {(props) => (
                    <Button {...props} variant="default" size="sm">
                      {archivo ? 'Cambiar archivo' : 'Cambiar imagen'}
                    </Button>
                  )}
                </FileButton>
              </Group>

              {imageError && (
                <Text size="sm" c="red" mt="sm" role="alert">
                  {imageError}
                </Text>
              )}
            </Box>
          </Box>

          {preciosModificados && simulacion !== null && (
            <Alert
              color={tasaCambio ? 'yellow' : 'blue'}
              variant="light"
              title={
                tasaCambio
                  ? 'La comisión vigente cambió'
                  : 'Los precios se van a recalcular'
              }
            >
              Al guardar, se vuelven a aplicar las comisiones vigentes y se
              actualiza el precio final al público. Tasa Menorcost vigente:{' '}
              {formatearTasa(simulacion.comisionMenorcostTasa)}
              {tasaCambio
                ? ` (antes ${formatearTasa(offer.comisionMenorcostTasaAplicada)}).`
                : '.'}
            </Alert>
          )}

          <SimuladorPreciosPanel
            resultado={simulacion}
            error={simulacionError}
            cargando={simulando}
            precioLista={precioLista}
          />

          {error && (
            <Alert color="red" variant="light" title="No se pudo guardar">
              {error}
            </Alert>
          )}

          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={handleClose}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={submitting} disabled={simulando}>
              Guardar cambios
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
