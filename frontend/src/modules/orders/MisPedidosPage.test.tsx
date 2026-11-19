// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MisPedidosPage } from './MisPedidosPage';
import type { PedidoResumen } from '../../api';

const mocks = vi.hoisted(() => ({
  listar: vi.fn(),
}));

vi.mock('../../api', () => ({
  ApiError: class ApiError extends Error {},
  pedidosApi: { listar: mocks.listar },
}));

vi.mock('../../auth/contexto', () => ({
  useAuth: () => ({ token: 'token', cargando: false }),
}));

const pedidos: PedidoResumen[] = [
  {
    idPedido: 'p1',
    codigoAlfanumerico: 'HRWWLBWY',
    estado: 'PENDIENTE_DE_RETIRO',
    fechaPedido: '2026-11-17T04:33:49.000Z',
    total: 5600,
    comercio: { idComercio: 'c1', nombre: 'Mercado del Barrio' },
    franjaHorario: { inicio: '09:00', fin: '10:00' },
    itemsCantidad: 2,
    items: [
      { titulo: 'Yogur natural', cantidad: 2 },
      { titulo: 'Pan de masa madre', cantidad: 1 },
    ],
  },
  {
    idPedido: 'p2',
    codigoAlfanumerico: 'P8A288MB',
    estado: 'ENTREGADO',
    fechaPedido: '2026-11-16T04:30:00.000Z',
    total: 2500,
    comercio: { idComercio: 'c2', nombre: 'Almacén del Centro' },
    franjaHorario: { inicio: '10:00', fin: '11:00' },
    itemsCantidad: 1,
    items: [{ titulo: 'Leche', cantidad: 1 }],
  },
];

function renderizar() {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={['/mis-pedidos']}>
        <Routes>
          <Route path="/mis-pedidos" element={<MisPedidosPage />} />
          <Route path="/pedido/:codigo" element={<div>Ticket QR</div>} />
        </Routes>
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe('MisPedidosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listar.mockResolvedValue(pedidos);
  });

  afterEach(() => {
    cleanup();
  });

  it('lista los pedidos con estado, total e ítems', async () => {
    renderizar();

    expect(await screen.findByText('#HRWWLBWY')).toBeTruthy();
    expect(screen.getByText('Mercado del Barrio')).toBeTruthy();
    expect(
      screen.getByText(/Retiro 09:00 – 10:00 · .* · Yogur natural x2, Pan de masa madre x1/),
    ).toBeTruthy();
    expect(screen.getByText('PENDIENTE_DE_RETIRO')).toBeTruthy();
    expect(screen.getByText('ENTREGADO')).toBeTruthy();
  });

  it('muestra "Ver ticket QR" solo para pedidos pendientes', async () => {
    renderizar();

    await screen.findByText('#HRWWLBWY');

    expect(screen.getByRole('button', { name: 'Ver ticket QR' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ver detalle' })).toBeTruthy();
  });

  it('navega al ticket al hacer clic en la acción', async () => {
    renderizar();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Ver ticket QR' }),
    );

    expect(await screen.findByText('Ticket QR')).toBeTruthy();
  });

  it('muestra el estado vacío cuando no hay pedidos', async () => {
    mocks.listar.mockResolvedValue([]);

    renderizar();

    expect(await screen.findByText('Todavía no tenés pedidos')).toBeTruthy();
  });
});
