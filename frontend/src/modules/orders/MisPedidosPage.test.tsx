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
import { MisPedidosPage } from './MisPedidosPage';
import type { PedidoResumen } from '../../api';

const mocks = vi.hoisted(() => ({
  listar: vi.fn(),
  listarNotificaciones: vi.fn(),
  marcarLeida: vi.fn(),
  reintentar: vi.fn(),
  redirigir: vi.fn(),
}));

vi.mock('../../api', () => ({
  ApiError: class ApiError extends Error {},
  pedidosApi: { listar: mocks.listar },
  notificacionesApi: {
    listar: mocks.listarNotificaciones,
    marcarLeida: mocks.marcarLeida,
  },
}));

vi.mock('./checkoutApi', () => ({
  checkoutApi: { reintentar: mocks.reintentar },
}));

vi.mock('./redireccion', () => ({
  redirigirFueraDeLaApp: mocks.redirigir,
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
    total: '5600.00',
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
    total: '2500.00',
    comercio: { idComercio: 'c2', nombre: 'Almacén del Centro' },
    franjaHorario: { inicio: '10:00', fin: '11:00' },
    itemsCantidad: 1,
    items: [{ titulo: 'Leche', cantidad: 1 }],
  },
  {
    idPedido: 'p3',
    codigoAlfanumerico: 'PAGO1234',
    estado: 'PENDIENTE_PAGO',
    fechaPedido: '2026-11-15T04:30:00.000Z',
    total: '1200.00',
    comercio: { idComercio: 'c3', nombre: 'Verdulería Norte' },
    franjaHorario: null,
    itemsCantidad: 1,
    items: [{ titulo: 'Tomates', cantidad: 1 }],
  },
];

function renderizar() {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={['/mis-pedidos']}>
        <Routes>
          <Route path="/mis-pedidos" element={<MisPedidosPage />} />
          <Route path="/pedido/:codigo" element={<div>Ticket QR</div>} />
          <Route path="/checkout/resultado" element={<div>Resultado pago</div>} />
        </Routes>
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe('MisPedidosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listar.mockResolvedValue(pedidos);
    mocks.listarNotificaciones.mockResolvedValue([]);
    mocks.marcarLeida.mockResolvedValue({});
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
    expect(screen.getByText('Pendiente de retiro')).toBeTruthy();
    expect(screen.getByText('Entregado')).toBeTruthy();
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

  it('muestra "Reintentar pago" para los pendientes de pago y redirige a MP', async () => {
    mocks.reintentar.mockResolvedValue({
      idPedido: 'p3',
      estado: 'PENDIENTE_PAGO',
      urlRedireccion: 'https://mp.test/ORD-3',
    });

    renderizar();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Reintentar pago' }),
    );

    await waitFor(() => {
      expect(mocks.reintentar).toHaveBeenCalledWith('token', 'p3');
      expect(mocks.redirigir).toHaveBeenCalledWith('https://mp.test/ORD-3');
    });
  });

  it('sin urlRedireccion al reintentar va a la pantalla de resultado', async () => {
    mocks.reintentar.mockResolvedValue({
      idPedido: 'p3',
      estado: 'PENDIENTE_PAGO',
      urlRedireccion: null,
    });

    renderizar();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Reintentar pago' }),
    );

    expect(await screen.findByText('Resultado pago')).toBeTruthy();
    expect(mocks.redirigir).not.toHaveBeenCalled();
  });

  it('muestra el estado vacío cuando no hay pedidos', async () => {
    mocks.listar.mockResolvedValue([]);

    renderizar();

    expect(await screen.findByText('Todavía no tenés pedidos')).toBeTruthy();
  });

  it('muestra los avisos de pedidos y permite descartarlos', async () => {
    const avisos = [
      {
        id: 'n1',
        titulo: 'Pedido cancelado',
        mensaje: 'El comercio canceló tu pedido MC-1.',
        tipo: 'PEDIDO_CANCELADO',
        leida: false,
        createdAt: '2026-11-18T10:00:00.000Z',
      },
      {
        id: 'n2',
        titulo: 'Oferta vencida',
        mensaje: 'No es un aviso de pedido.',
        tipo: 'OFERTA_VENCIDA',
        leida: false,
        createdAt: '2026-11-18T10:00:00.000Z',
      },
    ];

    mocks.listarNotificaciones.mockResolvedValue(avisos);
    // Al marcar como leída, el backend deja de devolverla en la próxima carga.
    mocks.marcarLeida.mockImplementation(async () => {
      mocks.listarNotificaciones.mockResolvedValue([
        { ...avisos[0], leida: true },
        avisos[1],
      ]);
      return {};
    });

    renderizar();

    expect(await screen.findByText('Pedido cancelado')).toBeTruthy();
    expect(screen.queryByText('Oferta vencida')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));

    await waitFor(() => expect(mocks.marcarLeida).toHaveBeenCalledWith('token', 'n1'));
    await waitFor(() =>
      expect(screen.queryByText('Pedido cancelado')).toBeNull(),
    );
  });
});
