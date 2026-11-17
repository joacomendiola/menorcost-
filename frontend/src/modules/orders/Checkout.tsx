import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Chip,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ApiError } from '../../api';
import { useAuth } from '../../auth/contexto';
import {
  checkoutApi,
  type CheckoutConfirmado,
  type CheckoutResumen,
  type ResultadoPagoSimulado,
} from './checkoutApi';

const moneda = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
});

function mensajeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return 'No pudimos completar el pago.';
}

export function Checkout() {
  const { comercioId } = useParams<{ comercioId: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [resumen, setResumen] = useState<CheckoutResumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [franjaId, setFranjaId] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [confirmado, setConfirmado] = useState<CheckoutConfirmado | null>(null);

  const parametrosInvalidos = !comercioId || !token;

  useEffect(() => {
    if (parametrosInvalidos) return;

    let activo = true;

    checkoutApi
      .obtenerResumen(token, comercioId)
      .then((data) => {
        if (!activo) return;

        setResumen(data);
        setError('');
      })
      .catch((err: unknown) => {
        if (activo) setError(mensajeError(err));
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [comercioId, parametrosInvalidos, token]);

  const franjaSeleccionada = useMemo(
    () => resumen?.franjas.find((franja) => franja.id === franjaId) ?? null,
    [franjaId, resumen],
  );

  async function pagar(resultado: ResultadoPagoSimulado) {
    if (!token || !comercioId || !franjaId) return;

    setPagando(true);

    try {
      const pedido = await checkoutApi.pagar(token, {
        comercioId,
        franjaHorarioId: franjaId,
        resultadoPagoSimulado: resultado,
      });

      setConfirmado(pedido);
      setConfirmando(false);
    } catch (err) {
      setConfirmando(false);
      const mensaje = mensajeError(err);

      setError(mensaje);
      notifications.show({
        color: 'red',
        title: 'Pago rechazado',
        message: mensaje,
      });
    } finally {
      setPagando(false);
    }
  }

  if (parametrosInvalidos) {
    return (
      <main className="comercio-page canastas-page">
        <Alert color="red">No se pudo identificar el pedido.</Alert>
      </main>
    );
  }

  if (cargando) {
    return (
      <main className="comercio-page canastas-page">
        <div className="tienda-cargando">
          <Loader color="brand" />
        </div>
      </main>
    );
  }

  if (!resumen) {
    return (
      <main className="comercio-page canastas-page">
        <Alert color="red">
          {error || 'No pudimos cargar el resumen del pedido.'}
        </Alert>

        <Button mt="md" variant="default" onClick={() => navigate(-1)}>
          ← Volver
        </Button>
      </main>
    );
  }

  if (confirmado) {
    return (
      <main className="comercio-page canastas-page">
        <Paper withBorder p="lg" radius="lg">
          <Stack gap="sm">
            <Title order={2}>¡Pago aprobado!</Title>

            <Text c="dimmed">
              Guardá tu código para retirar el pedido en el mostrador.
            </Text>

            <Paper withBorder p="md" radius="md" bg="brand.0">
              <Stack gap={4} align="center">
                <Text size="sm" c="dimmed">
                  Código de retiro
                </Text>
                <Text fw={800} size="xl" style={{ letterSpacing: 2 }}>
                  {confirmado.codigoAlfanumerico}
                </Text>
              </Stack>
            </Paper>

            <Group justify="space-between">
              <Text>Total pagado</Text>
              <Text fw={700}>{moneda.format(Number(confirmado.total))}</Text>
            </Group>

            <Button
              fullWidth
              mt="sm"
              onClick={() => navigate(`/comercios/${comercioId}`)}
            >
              Seguir comprando
            </Button>
          </Stack>
        </Paper>
      </main>
    );
  }

  const sinFranjas = resumen.franjas.length === 0;

  return (
    <main className="comercio-page canastas-page">
      <button
        type="button"
        className="chip"
        onClick={() => navigate(`/canastas/${comercioId}`)}
      >
        ← Volver a la canasta
      </button>

      <Stack gap="lg" mt="md">
        <div>
          <Title order={1}>Pagar pedido</Title>
          <Text c="dimmed">{resumen.comercio.nombreFantasia}</Text>
          <Text size="sm" c="dimmed">
            {resumen.comercio.direccion}
          </Text>
        </div>

        <Paper withBorder p="lg" radius="lg">
          <Stack gap="md">
            <Title order={3}>Detalle</Title>

            {resumen.items.map((item) => (
              <Group key={item.productoId} justify="space-between" wrap="nowrap">
                <div>
                  <Text fw={600}>{item.titulo}</Text>
                  <Text size="sm" c="dimmed">
                    {item.cantidad} × {moneda.format(Number(item.precioUnitario))}
                  </Text>
                </div>
                <Text>{moneda.format(Number(item.subtotal))}</Text>
              </Group>
            ))}

            <Divider />

            <Group justify="space-between">
              <Text c="dimmed">Subtotal</Text>
              <Text>{moneda.format(Number(resumen.subtotal))}</Text>
            </Group>

            <Divider />

            <Group justify="space-between">
              <Text fw={700} size="lg">
                Total
              </Text>
              <Text fw={700} size="lg">
                {moneda.format(Number(resumen.total))}
              </Text>
            </Group>
          </Stack>
        </Paper>

        <Paper withBorder p="lg" radius="lg">
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={3}>Franja de retiro</Title>
              {franjaSeleccionada && (
                <Badge color="brand" variant="light">
                  {franjaSeleccionada.etiqueta}
                </Badge>
              )}
            </Group>

            {sinFranjas ? (
              <Alert color="yellow">
                Este comercio todavía no tiene franjas de retiro configuradas.
              </Alert>
            ) : (
              <Chip.Group
                multiple={false}
                value={franjaId}
                onChange={(valor) =>
                  setFranjaId(typeof valor === 'string' ? valor : null)
                }
              >
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  {resumen.franjas.map((franja) => (
                    <Chip key={franja.id} value={franja.id} variant="outline">
                      {franja.etiqueta}
                    </Chip>
                  ))}
                </SimpleGrid>
              </Chip.Group>
            )}
          </Stack>
        </Paper>

        {error && <Alert color="red">{error}</Alert>}

        <Alert color="blue">
          Pago de prueba: no se cobra dinero real. Podés aprobar o rechazar el
          cobro para ver el circuito completo.
        </Alert>

        <Button
          fullWidth
          size="lg"
          disabled={!franjaId}
          loading={pagando}
          onClick={() => setConfirmando(true)}
        >
          PAGAR
        </Button>
      </Stack>

      <Modal
        opened={confirmando}
        onClose={() => (pagando ? undefined : setConfirmando(false))}
        title="Simular pago"
        centered
      >
        <Stack gap="md">
          <Text>
            Total a cobrar:{' '}
            <strong>{moneda.format(Number(resumen.total))}</strong>
          </Text>
          <Text size="sm" c="dimmed">
            Elegí el resultado que devolvería la pasarela.
          </Text>

          <Group grow>
            <Button
              color="red"
              variant="light"
              loading={pagando}
              onClick={() => void pagar('RECHAZADO')}
            >
              Rechazar
            </Button>
            <Button loading={pagando} onClick={() => void pagar('APROBADO')}>
              Aprobar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </main>
  );
}
