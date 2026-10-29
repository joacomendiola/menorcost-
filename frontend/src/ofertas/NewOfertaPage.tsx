import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  Container,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { ApiError, api } from '../api';
import { useAuth } from '../auth/contexto';
import { NewOfferForm } from './NewOfertaForm';

type Option = {
  id: string;
  nombre: string;
};

type ComercioPropio = {
  id: string;
  nombreFantasia: string;
};

type Categoria = Option & {
  slug: string;
  orden: number;
};

export function NuevaOfertaPage() {
  const { usuario, token } = useAuth();
  const [comercios, setComercios] = useState<Option[]>([]);
  const [categorias, setCategorias] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);
  const missingSession = usuario?.rol === 'COMERCIANTE' && !token;

  useEffect(() => {
    if (usuario?.rol !== 'COMERCIANTE' || !token) return;

    let active = true;

    void Promise.all([
      api<ComercioPropio>('/comercios/mio', { token }),
      api<Categoria[]>('/categorias'),
    ])
      .then(([comercio, categoriasDisponibles]) => {
        if (!active) return;

        setComercios([
          {
            id: comercio.id,
            nombre: comercio.nombreFantasia,
          },
        ]);
        setCategorias(
          categoriasDisponibles.map(({ id, nombre }) => ({ id, nombre })),
        );
      })
      .catch((error: unknown) => {
        if (!active) return;

        if (error instanceof ApiError && error.status === 404) {
          setLoadError(
            'Todavía no tenés un comercio registrado. Registrá tu comercio antes de publicar ofertas.',
          );
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'No se pudieron cargar los datos para publicar.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token, usuario?.rol, reloadCount]);

  const comercio = comercios[0];

  return (
    <Container component="main" size={820} px="md" py={{ base: 28, md: 48 }}>
      <Stack gap="lg">
        <Button
          component={Link}
          to="/ofertas/mias"
          variant="default"
          radius="xl"
          size="compact-sm"
          w="fit-content"
          leftSection="←"
        >
          Mis productos
        </Button>

        <Title order={1} fz={{ base: 26, sm: 28 }} lh={1.15}>
          Nueva oferta
        </Title>

        {usuario?.rol !== 'COMERCIANTE' && (
          <Alert color="red" variant="light" title="Sección para comerciantes">
            Esta sección está disponible para cuentas de comerciante.
          </Alert>
        )}

        {missingSession && (
          <Alert color="red" variant="light">
            No se encontró una sesión válida. Iniciá sesión nuevamente.
          </Alert>
        )}

        {loading && !missingSession && usuario?.rol === 'COMERCIANTE' && (
          <Paper withBorder radius="lg" p="xl" shadow="xs">
            <Group gap="sm">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">
                Cargando comercio y categorías…
              </Text>
            </Group>
          </Paper>
        )}

        {loadError && (
          <Alert color="red" variant="light" title="No pudimos cargar los datos">
            <Stack gap="sm" align="flex-start">
              <Text size="sm">{loadError}</Text>

              {loadError.includes('comercio registrado') && (
                <Button
                  component={Link}
                  to="/comercios/registro"
                  variant="light"
                  size="sm"
                >
                  Registrar mi comercio
                </Button>
              )}
            </Stack>
          </Alert>
        )}

        {token && loadError && !loading && (
          <Button
            type="button"
            variant="default"
            w="fit-content"
            onClick={() => {
              setLoading(true);
              setLoadError('');
              setReloadCount((count) => count + 1);
            }}
          >
            Reintentar
          </Button>
        )}

        {!loading &&
          !loadError &&
          usuario?.rol === 'COMERCIANTE' &&
          categorias.length === 0 && (
            <Alert color="gray" variant="light">
              No hay categorías disponibles para publicar una oferta.
            </Alert>
          )}

        {!loading &&
          !loadError &&
          usuario?.rol === 'COMERCIANTE' &&
          comercio &&
          categorias.length > 0 && (
            <NewOfferForm
              token={token ?? ''}
              comercioId={comercio.id}
              categorias={categorias}
            />
          )}
      </Stack>
    </Container>
  );
}
