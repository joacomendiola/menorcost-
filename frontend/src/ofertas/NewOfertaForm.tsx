import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  FileButton,
  Group,
  Image,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { SimuladorPreciosPanel } from './simulador/SimuladorPreciosPanel';
import { useSimuladorPrecios } from './simulador/useSimuladorPrecios';

type Option = {
  id: string;
  nombre: string;
};

type Props = {
  token: string;
  comercioId: string;
  categorias: Option[];
};

type TipoOferta = 'INDIVIDUAL' | 'COMBO';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function localDateString() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const localDate = new Date(
    tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60_000,
  );

  return localDate.toISOString().slice(0, 10);
}

function mensajeDeError(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;

    if (Array.isArray(message)) {
      return message.filter((item): item is string => typeof item === 'string').join('. ');
    }

    if (typeof message === 'string') {
      return message;
    }
  }

  return `No pudimos publicar la oferta (${status}).`;
}

export function NewOfferForm({ token, comercioId, categorias }: Props) {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [tipo, setTipo] = useState<TipoOferta>('INDIVIDUAL');
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState(localDateString());
  const [stock, setStock] = useState('');
  const [precioLista, setPrecioLista] = useState('');
  const [precioBaseNeto, setPrecioBaseNeto] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [imageError, setImageError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!token) {
      setError('Iniciá sesión para publicar una oferta.');
      return;
    }

    if (!comercioId) {
      setError('No encontramos el comercio asociado a tu cuenta.');
      return;
    }

    if (!categoriaId) {
      setError('Seleccioná una categoría.');
      return;
    }

    if (!titulo.trim()) {
      setError('Ingresá un título para la oferta.');
      return;
    }

    if (!descripcion.trim()) {
      setError('Ingresá una descripción para la oferta.');
      return;
    }

    if (!fechaVencimiento || fechaVencimiento <= localDateString()) {
      setError('La fecha de vencimiento debe ser posterior a hoy.');
      return;
    }

    const stockNumero = Number(stock);

    if (!Number.isInteger(stockNumero) || stockNumero < 1) {
      setError('El stock debe ser un número entero mayor o igual a 1.');
      return;
    }

    if (!archivo) {
      setError('Adjuntá una fotografía para la oferta.');
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
        'El precio promocional debe ofrecer un descuento real respecto al precio de lista original.',
      );
      return;
    }

    const data = new FormData();
    data.set('tipo', tipo);
    data.set('comercioId', comercioId);
    data.set('categoriaId', categoriaId);
    data.set('titulo', titulo.trim());
    data.set('descripcion', descripcion.trim());
    data.set('fechaVencimiento', fechaVencimiento);
    data.set('stock', String(stockNumero));
    data.set('precioLista', precioLista);
    data.set('precioMenorcost', simulacion.precioPublico);
    data.set('imagen', archivo);

    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/offers`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: data,
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(mensajeDeError(payload, response.status));
      }

      setMessage('Oferta publicada correctamente.');

      setTipo('INDIVIDUAL');
      setCategoriaId(null);
      setTitulo('');
      setDescripcion('');
      setFechaVencimiento(localDateString());
      setStock('');
      setPrecioLista('');
      setPrecioBaseNeto('');
      setArchivo(null);
      setPreviewUrl(null);
      setImageError('');
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Ocurrió un error inesperado al publicar.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Paper
      component="form"
      onSubmit={handleSubmit}
      withBorder
      shadow="xs"
      radius="lg"
      p={{ base: 'md', sm: 'xl' }}
    >
      <Stack gap="lg">
        <Group gap="sm">
          <Button
            type="button"
            radius="xl"
            size="sm"
            variant={tipo === 'INDIVIDUAL' ? 'filled' : 'default'}
            aria-pressed={tipo === 'INDIVIDUAL'}
            onClick={() => setTipo('INDIVIDUAL')}
          >
            Producto individual
          </Button>

          <Button
            type="button"
            radius="xl"
            size="sm"
            variant={tipo === 'COMBO' ? 'filled' : 'default'}
            aria-pressed={tipo === 'COMBO'}
            onClick={() => setTipo('COMBO')}
          >
            Canasta / Combo Ahorro
          </Button>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="Título"
            placeholder="Ej: Yogur natural x2"
            value={titulo}
            onChange={(event) => setTitulo(event.currentTarget.value)}
            maxLength={120}
            required
          />

          <Select
            label="Categoría"
            placeholder="Seleccionar..."
            data={categorias.map((categoria) => ({
              value: categoria.id,
              label: categoria.nombre,
            }))}
            value={categoriaId}
            onChange={setCategoriaId}
            searchable
            required
          />

          <TextInput
            label="Fecha de vencimiento"
            type="date"
            min={localDateString()}
            value={fechaVencimiento}
            onChange={(event) => setFechaVencimiento(event.currentTarget.value)}
            required
          />

          <TextInput
            label="Stock"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="Cantidad de unidades"
            value={stock}
            onChange={(event) => setStock(event.currentTarget.value)}
            required
          />

          <TextInput
            label="Precio de lista original"
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            leftSection={<Text size="sm" c="dimmed">$</Text>}
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
            leftSection={<Text size="sm" c="dimmed">$</Text>}
            value={precioBaseNeto}
            onChange={(event) => setPrecioBaseNeto(event.currentTarget.value)}
            description="Lo que querés recibir después de las comisiones."
            required
          />
        </SimpleGrid>

        <Textarea
          label="Descripción detallada del contenido"
          placeholder="Ej: 2 yogures + 1 leche"
          value={descripcion}
          onChange={(event) => setDescripcion(event.currentTarget.value)}
          maxLength={2000}
          minRows={3}
          autosize
          required
        />

        <Box>
          <Text size="sm" fw={600} mb={6}>
            Fotografía
          </Text>

          <Paper withBorder radius="md" p="md" bg="#F8FAFC">
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
                  {previewUrl ? (
                    <Image
                      src={previewUrl}
                      alt="Vista previa de la fotografía"
                      w={52}
                      h={52}
                      fit="cover"
                    />
                  ) : (
                    <Text size="xl" aria-hidden="true">
                      📷
                    </Text>
                  )}
                </Box>

                <Box>
                  <Text size="sm" fw={600}>
                    {archivo ? archivo.name : 'Adjuntá una foto de la oferta'}
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
                    Elegir archivo
                  </Button>
                )}
              </FileButton>
            </Group>

            {imageError && (
              <Text size="sm" c="red" mt="sm" role="alert">
                {imageError}
              </Text>
            )}
          </Paper>
        </Box>

        <SimuladorPreciosPanel
          resultado={simulacion}
          error={simulacionError}
          cargando={simulando}
        />

        {error && (
          <Alert color="red" variant="light" title="No se pudo publicar la oferta">
            {error}
          </Alert>
        )}

        {message && (
          <Alert color="green" variant="light">
            {message}
          </Alert>
        )}

        <Button
          type="submit"
          fullWidth
          size="md"
          loading={submitting}
          disabled={simulando}
        >
          Publicar oferta
        </Button>
      </Stack>
    </Paper>
  );
}
