import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { ApiError } from '../../api';
import { useAuth } from '../../auth/contexto';
import { checkoutApi, type EstadoPedidoCheckout } from './checkoutApi';
import { redirigirFueraDeLaApp } from './redireccion';

/** Cada cuánto se consulta el estado real del pedido. */
const INTERVALO_POLLING_MS = 3_000;
/** Tope de espera: el webhook puede demorar, pero la pantalla no queda colgada. */
const LIMITE_POLLING_MS = 60_000;

function mensajeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return 'No pudimos reintentar el pago.';
}

/**
 * Pantalla de vuelta de Mercado Pago (`/checkout/resultado`).
 *
 * No confía en el query param `estado` que agrega MP: consulta el estado real
 * del pedido hasta que el webhook lo confirme o se agote el tiempo de espera.
 */
export function ResultadoPagoPage() {
  const [params] = useSearchParams();
  const idPedido = params.get('idPedido');
  const { token } = useAuth();
  const navigate = useNavigate();

  const [estado, setEstado] = useState<EstadoPedidoCheckout | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [agotado, setAgotado] = useState(false);
  const [reintentando, setReintentando] = useState(false);
  const [errorReintento, setErrorReintento] = useState('');

  useEffect(() => {
    if (!token || !idPedido) return;

    let activo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let enVuelo = false;
    const inicio = Date.now();

    const consultar = async () => {
      if (!activo || enVuelo) return;

      enVuelo = true;

      try {
        const data = await checkoutApi.obtenerEstado(token, idPedido);
        if (!activo) return;

        setEstado(data);
        setError('');
        setCargando(false);

        // El pago ya se resolvió (acreditado o el pedido se cerró): se frena.
        if (data.estado !== 'PENDIENTE_PAGO') return;

        if (Date.now() - inicio >= LIMITE_POLLING_MS) {
          setAgotado(true);
          return;
        }

        timer = setTimeout(() => void consultar(), INTERVALO_POLLING_MS);
      } catch (err) {
        if (!activo) return;

        setCargando(false);

        // 404: no existe o es de otro usuario. 400: id que no es UUID.
        if (
          err instanceof ApiError &&
          (err.status === 400 || err.status === 404)
        ) {
          setError(
            err.status === 404
              ? 'No encontramos ese pedido.'
              : 'El pedido indicado no es válido.',
          );
          return;
        }

        if (Date.now() - inicio >= LIMITE_POLLING_MS) {
          setAgotado(true);
          return;
        }

        // Error transitorio (red, 5xx): se sigue intentando hasta el tope.
        timer = setTimeout(() => void consultar(), INTERVALO_POLLING_MS);
      } finally {
        enVuelo = false;
      }
    };

    void consultar();

    return () => {
      activo = false;
      if (timer) clearTimeout(timer);
    };
  }, [idPedido, token]);

  async function reintentar() {
    if (!token || !idPedido) return;

    setReintentando(true);
    setErrorReintento('');

    try {
      const pedido = await checkoutApi.reintentar(token, idPedido);

      if (!pedido.urlRedireccion) {
        setErrorReintento(
          'Mercado Pago no devolvió un checkout para reintentar el pago.',
        );
        return;
      }

      redirigirFueraDeLaApp(pedido.urlRedireccion);
    } catch (err) {
      setErrorReintento(mensajeError(err));
    } finally {
      setReintentando(false);
    }
  }

  function irAMisPedidos() {
    navigate('/mis-pedidos');
  }

  if (!idPedido) {
    return (
      <main className="comercio-page canastas-page">
        <Stack gap="md">
          <Alert color="red">
            No pudimos identificar el pedido: falta el identificador en la URL.
          </Alert>

          <Button variant="default" onClick={irAMisPedidos}>
            Ir a mis pedidos
          </Button>
        </Stack>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="comercio-page canastas-page">
        <Alert color="red">
          Necesitás una sesión activa para ver el resultado del pago.
        </Alert>
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

  if (error) {
    return (
      <main className="comercio-page canastas-page">
        <Stack gap="md">
          <Alert color="red">{error}</Alert>

          <Button variant="default" onClick={irAMisPedidos}>
            Ir a mis pedidos
          </Button>
        </Stack>
      </main>
    );
  }

  if (!estado) {
    return (
      <main className="comercio-page canastas-page">
        <Stack gap="md">
          <Alert color="yellow">
            No pudimos consultar el estado del pedido.
          </Alert>

          <Group>
            <Button loading={reintentando} onClick={() => void reintentar()}>
              Reintentar pago
            </Button>
            <Button variant="default" onClick={irAMisPedidos}>
              Ir a mis pedidos
            </Button>
          </Group>
        </Stack>
      </main>
    );
  }

  const pagoRechazado = estado.pagoEstado === 'RECHAZADO';

  if (estado.estado === 'PENDIENTE_PAGO') {
    const puedeVolverAlCheckout = Boolean(estado.urlRedireccion) && !pagoRechazado;

    return (
      <main className="comercio-page canastas-page">
        <Stack gap="lg" mt="md">
          <Title order={1}>
            {pagoRechazado ? 'Pago rechazado' : 'Esperando confirmación'}
          </Title>

          <Paper withBorder p="lg" radius="lg">
            <Stack gap="md">
              <Text>
                {pagoRechazado
                  ? 'Mercado Pago rechazó el intento de pago. Podés probar con otro medio.'
                  : 'Mercado Pago todavía no nos confirmó el pago. Esta pantalla se actualiza sola.'}
              </Text>

              {agotado && (
                <Alert color="yellow">
                  Pasó más de un minuto y no recibimos la confirmación. Si el
                  pago se acreditó, el pedido se va a actualizar en Mis pedidos.
                </Alert>
              )}

              {errorReintento && <Alert color="red">{errorReintento}</Alert>}
            </Stack>
          </Paper>

          <Group>
            {puedeVolverAlCheckout && !agotado && (
              <Button
                onClick={() =>
                  redirigirFueraDeLaApp(estado.urlRedireccion as string)
                }
              >
                Volver a Mercado Pago
              </Button>
            )}

            {(pagoRechazado || agotado || !estado.urlRedireccion) && (
              <Button
                loading={reintentando}
                onClick={() => void reintentar()}
              >
                Reintentar pago
              </Button>
            )}

            <Button variant="default" onClick={irAMisPedidos}>
              Ir a mis pedidos
            </Button>
          </Group>
        </Stack>
      </main>
    );
  }

  if (
    estado.estado === 'PENDIENTE_DE_RETIRO' ||
    estado.estado === 'ENTREGADO'
  ) {
    return (
      <main className="comercio-page canastas-page">
        <Stack gap="lg" mt="md">
          <Title order={1}>Pago acreditado</Title>

          <Paper withBorder p="lg" radius="lg">
            <Text>
              {estado.estado === 'ENTREGADO'
                ? 'El pedido ya fue entregado en el comercio.'
                : 'Tu pedido quedó confirmado. Acercate al comercio dentro de la franja elegida con el QR del ticket.'}
            </Text>
          </Paper>

          <Group>
            <Button
              onClick={() =>
                navigate(
                  `/pedido/${encodeURIComponent(estado.codigoAlfanumerico)}`,
                )
              }
            >
              Ver ticket QR
            </Button>
            <Button variant="default" onClick={irAMisPedidos}>
              Ir a mis pedidos
            </Button>
          </Group>
        </Stack>
      </main>
    );
  }

  return (
    <main className="comercio-page canastas-page">
      <Stack gap="md">
        <Title order={1}>Pedido cancelado</Title>

        <Alert color="red">
          El pedido se canceló y el stock volvió a estar disponible. Si
          necesitás el producto, podés volver a comprarlo.
        </Alert>

        <Button variant="default" onClick={irAMisPedidos}>
          Ir a mis pedidos
        </Button>
      </Stack>
    </main>
  );
}
