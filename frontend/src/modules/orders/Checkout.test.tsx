// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Checkout } from './Checkout';
import type { CheckoutResumen } from './checkoutApi';

const mocks = vi.hoisted(() => ({
  obtenerResumen: vi.fn(),
  pagar: vi.fn(),
  redirigir: vi.fn(),
  show: vi.fn(),
}));

vi.mock('./checkoutApi', () => ({
  checkoutApi: {
    obtenerResumen: mocks.obtenerResumen,
    pagar: mocks.pagar,
  },
}));

vi.mock('./redireccion', () => ({
  redirigirFueraDeLaApp: mocks.redirigir,
}));

vi.mock('../../auth/contexto', () => ({
  useAuth: () => ({ token: 'token', cargando: false }),
}));

vi.mock('@mantine/notifications', () => ({
  notifications: { show: mocks.show },
}));

const comercioId = 'comercio-1';

const resumen: CheckoutResumen = {
  comercio: {
    idComercio: comercioId,
    nombreFantasia: 'Almacén del Centro',
    direccion: 'Av. San Martín 123, Ushuaia',
    abierto: true,
  },
  items: [
    {
      productoId: 'p1',
      titulo: 'Yogur entero',
      imagen: '/uploads/yogur.jpg',
      cantidad: 2,
      precioUnitario: '4705.89',
      subtotal: '9411.78',
    },
  ],
  subtotal: '9411.78',
  total: '9411.78',
  franjas: [
    {
      id: 'f1',
      diaSemana: 2,
      horaInicio: '10:00',
      horaFin: '11:00',
      fechaRetiro: '2026-11-24',
      etiqueta: 'Mar 24/11 · 10:00 a 11:00',
    },
  ],
};

function renderizar() {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={[`/checkout/${comercioId}`]}>
        <Routes>
          <Route path="/checkout/:comercioId" element={<Checkout />} />
          <Route
            path="/checkout/resultado"
            element={<div>Resultado del pago</div>}
          />
          <Route path="/comercios/:comercioId" element={<div>Tienda</div>} />
          <Route path="/canastas/:comercioId" element={<div>Canasta</div>} />
          <Route path="/pedido/:codigo" element={<div>Ticket QR</div>} />
        </Routes>
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe('Checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.obtenerResumen.mockResolvedValue(resumen);
  });

  afterEach(() => {
    cleanup();
  });

  it('muestra el detalle y exige elegir una franja antes de pagar', async () => {
    renderizar();

    expect(await screen.findByText('Yogur entero')).toBeTruthy();
    expect(screen.getByText(/Almacén del Centro/)).toBeTruthy();
    expect(screen.getByText(/Av\. San Martín 123/)).toBeTruthy();

    const pagar = screen.getByRole('button', {
      name: 'PAGAR',
    }) as HTMLButtonElement;
    expect(pagar.disabled).toBe(true);

    fireEvent.click(screen.getByText('Mar 24/11 · 10:00 a 11:00'));

    await waitFor(() => {
      const habilitado = screen.getByRole('button', {
        name: 'PAGAR',
      }) as HTMLButtonElement;
      expect(habilitado.disabled).toBe(false);
    });
  });

  it('al pagar redirige al checkout de Mercado Pago', async () => {
    mocks.pagar.mockResolvedValue({
      idPedido: 'pedido-1',
      estado: 'PENDIENTE_PAGO',
      urlRedireccion: 'https://mp.test/ORD-1',
    });

    renderizar();

    await screen.findByText('Yogur entero');
    fireEvent.click(screen.getByText('Mar 24/11 · 10:00 a 11:00'));
    fireEvent.click(screen.getByRole('button', { name: 'PAGAR' }));

    await waitFor(() => {
      expect(mocks.redirigir).toHaveBeenCalledWith('https://mp.test/ORD-1');
    });

    expect(screen.queryByText('Resultado del pago')).toBeNull();
    expect(mocks.pagar).toHaveBeenCalledWith('token', {
      comercioId,
      franjaHorarioId: 'f1',
      idempotencyKey: expect.any(String),
    });
  });

  it('sin urlRedireccion navega a la pantalla de resultado', async () => {
    mocks.pagar.mockResolvedValue({
      idPedido: 'pedido-1',
      estado: 'PENDIENTE_PAGO',
      urlRedireccion: null,
    });

    renderizar();

    await screen.findByText('Yogur entero');
    fireEvent.click(screen.getByText('Mar 24/11 · 10:00 a 11:00'));
    fireEvent.click(screen.getByRole('button', { name: 'PAGAR' }));

    expect(await screen.findByText('Resultado del pago')).toBeTruthy();
    expect(mocks.redirigir).not.toHaveBeenCalled();
  });

  it('deshabilita el botón mientras el POST está en curso', async () => {
    mocks.pagar.mockReturnValue(new Promise(() => undefined));

    renderizar();

    await screen.findByText('Yogur entero');
    fireEvent.click(screen.getByText('Mar 24/11 · 10:00 a 11:00'));

    const pagar = screen.getByRole('button', {
      name: 'PAGAR',
    }) as HTMLButtonElement;
    fireEvent.click(pagar);

    await waitFor(() => {
      expect(pagar.disabled).toBe(true);
    });
  });

  it('si el pago falla muestra el error y no confirma el pedido', async () => {
    mocks.pagar.mockRejectedValue(
      new Error('El pago con Mercado Pago todavía no está disponible.'),
    );

    renderizar();

    await screen.findByText('Yogur entero');
    fireEvent.click(screen.getByText('Mar 24/11 · 10:00 a 11:00'));
    fireEvent.click(screen.getByRole('button', { name: 'PAGAR' }));

    await waitFor(() => {
      expect(mocks.show).toHaveBeenCalled();
    });

    expect(screen.queryByText('Resultado del pago')).toBeNull();
    expect(mocks.redirigir).not.toHaveBeenCalled();
  });
});
