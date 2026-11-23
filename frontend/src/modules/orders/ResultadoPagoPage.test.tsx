// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api';
import { ResultadoPagoPage } from './ResultadoPagoPage';
import type { EstadoPedidoCheckout } from './checkoutApi';

const mocks = vi.hoisted(() => ({
  obtenerEstado: vi.fn(),
  reintentar: vi.fn(),
  redirigir: vi.fn(),
}));

vi.mock('./checkoutApi', () => ({
  checkoutApi: {
    obtenerEstado: mocks.obtenerEstado,
    reintentar: mocks.reintentar,
  },
}));

vi.mock('./redireccion', () => ({
  redirigirFueraDeLaApp: mocks.redirigir,
}));

vi.mock('../../auth/contexto', () => ({
  useAuth: () => ({ token: 'token', cargando: false }),
}));

const pendiente: EstadoPedidoCheckout = {
  idPedido: 'pedido-1',
  estado: 'PENDIENTE_PAGO',
  pagoEstado: 'PENDIENTE',
  codigoAlfanumerico: 'ABC12345',
  urlRedireccion: 'https://mp.test/ORD-1',
};

function renderizar(entrada = '/checkout/resultado?idPedido=pedido-1') {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={[entrada]}>
        <Routes>
          <Route path="/checkout/resultado" element={<ResultadoPagoPage />} />
          <Route path="/pedido/:codigo" element={<div>Ticket QR</div>} />
          <Route path="/mis-pedidos" element={<div>Mis pedidos</div>} />
        </Routes>
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe('ResultadoPagoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('muestra el pago acreditado y lleva al ticket', async () => {
    mocks.obtenerEstado.mockResolvedValue({
      ...pendiente,
      estado: 'PENDIENTE_DE_RETIRO',
      pagoEstado: 'PAGADO',
      urlRedireccion: null,
    });

    renderizar();

    expect(await screen.findByText('Pago acreditado')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Ver ticket QR' }));

    expect(await screen.findByText('Ticket QR')).toBeTruthy();
  });

  it('mientras espera ofrece volver al checkout de Mercado Pago', async () => {
    mocks.obtenerEstado.mockResolvedValue(pendiente);

    renderizar();

    expect(await screen.findByText('Esperando confirmación')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Volver a Mercado Pago' }),
    );

    expect(mocks.redirigir).toHaveBeenCalledWith('https://mp.test/ORD-1');
  });

  it('si el pago fue rechazado permite reintentar', async () => {
    mocks.obtenerEstado.mockResolvedValue({
      ...pendiente,
      pagoEstado: 'RECHAZADO',
      urlRedireccion: null,
    });
    mocks.reintentar.mockResolvedValue({
      idPedido: 'pedido-1',
      estado: 'PENDIENTE_PAGO',
      urlRedireccion: 'https://mp.test/ORD-2',
    });

    renderizar();

    expect(await screen.findByText('Pago rechazado')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar pago' }));

    await waitFor(() => {
      expect(mocks.reintentar).toHaveBeenCalledWith('token', 'pedido-1');
      expect(mocks.redirigir).toHaveBeenCalledWith('https://mp.test/ORD-2');
    });
  });

  it('sin idPedido en la URL no consulta la API y ofrece volver', async () => {
    renderizar('/checkout/resultado');

    expect(
      await screen.findByText(/falta el identificador en la URL/),
    ).toBeTruthy();
    expect(mocks.obtenerEstado).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Ir a mis pedidos' }));

    expect(await screen.findByText('Mis pedidos')).toBeTruthy();
  });

  it('muestra un error claro si el pedido no existe', async () => {
    mocks.obtenerEstado.mockRejectedValue(
      new ApiError(404, 'Pedido no encontrado.'),
    );

    renderizar();

    expect(await screen.findByText('No encontramos ese pedido.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ir a mis pedidos' })).toBeTruthy();
  });

  it('frena el polling a los 60 segundos y limpia el timer al desmontar', async () => {
    vi.useFakeTimers();
    mocks.obtenerEstado.mockResolvedValue(pendiente);

    const { unmount } = renderizar();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText('Esperando confirmación')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    expect(screen.getByText(/Pasó más de un minuto/)).toBeTruthy();

    const llamadas = mocks.obtenerEstado.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(mocks.obtenerEstado.mock.calls.length).toBe(llamadas);

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(mocks.obtenerEstado.mock.calls.length).toBe(llamadas);
  });
});
