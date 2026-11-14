// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PedidosPanel } from './PedidosPanel';
import type { PedidoReportableComerciante } from '../../api';

const mocks = vi.hoisted(() => ({
  pedidosComerciante: vi.fn(),
  crear: vi.fn(),
  show: vi.fn(),
  cerrarSesion: vi.fn(),
}));

vi.mock('../../api', () => ({
  ApiError: class ApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  reportesApi: {
    pedidosComerciante: mocks.pedidosComerciante,
    crear: mocks.crear,
  },
}));

vi.mock('../../auth/contexto', () => ({
  useAuth: () => ({ token: 'token', cerrarSesion: mocks.cerrarSesion }),
}));

vi.mock('@mantine/notifications', () => ({
  notifications: { show: mocks.show },
}));

const pedidoBase: PedidoReportableComerciante = {
  id_pedido: 'p2',
  codigoAlfanumerico: 'MC-2',
  estado: 'ENTREGADO',
  fecha_pedido: '2026-01-01T00:00:00.000Z',
  total: 1500,
  items: [{ cantidad: 2, producto: { titulo: 'Producto' } }],
  reporteAbierto: null,
};

function pedido(
  overrides: Partial<PedidoReportableComerciante> = {},
): PedidoReportableComerciante {
  return { ...pedidoBase, ...overrides };
}

function renderPanel() {
  return render(
    <MantineProvider>
      <PedidosPanel />
    </MantineProvider>,
  );
}

async function elegirMotivo(label: string) {
  fireEvent.click(screen.getByRole('combobox'));
  fireEvent.click(await screen.findByText(label));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pedidosComerciante.mockResolvedValue([pedido()]);
  mocks.crear.mockResolvedValue({
    id_reporte: 10,
    motivo: 'El cliente no se presentó a retirar el producto',
    descripcion: null,
    estado_reporte: 'PENDIENTE_REVISION',
    tipo_destino: 'CLIENTE',
    fecha_reporte: '2026-01-02T00:00:00.000Z',
    notificacionSoporte: { enviada: true, destinatarios: 1 },
  });
});

afterEach(cleanup);

describe('PedidosPanel', () => {
  it('muestra los pedidos reportables del comerciante', async () => {
    renderPanel();

    await screen.findByText('Pedido MC-2');
    expect(screen.getByText(/2× Producto/)).toBeTruthy();
    expect(mocks.pedidosComerciante).toHaveBeenCalledWith('token');
  });

  it('exige descripción cuando el motivo es "Otro motivo"', async () => {
    renderPanel();
    await screen.findByText('Pedido MC-2');

    await elegirMotivo('Otro motivo');
    fireEvent.submit(
      screen.getByRole('button', { name: 'Reportar problema' }).closest('form')!,
    );

    await waitFor(() =>
      expect(mocks.show).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Especificá brevemente el problema ocurrido',
        }),
      ),
    );
    expect(mocks.crear).not.toHaveBeenCalled();
  });

  it('envía un reporte al cliente y muestra el estado del reporte', async () => {
    renderPanel();
    await screen.findByText('Pedido MC-2');

    await elegirMotivo('El cliente no se presentó a retirar el producto');
    fireEvent.click(screen.getByRole('button', { name: 'Reportar problema' }));

    await waitFor(() =>
      expect(mocks.crear).toHaveBeenCalledWith('token', {
        idPedido: 'p2',
        motivo: 'El cliente no se presentó a retirar el producto',
        descripcion: undefined,
        tipo_destino: 'CLIENTE',
      }),
    );
    await screen.findByText(/Ya enviaste un reporte para este pedido/);
    expect(screen.getByText('PENDIENTE_REVISION')).toBeTruthy();
    expect(mocks.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Reporte enviado' }),
    );
  });

  it('no muestra el formulario si ya existe un reporte abierto', async () => {
    mocks.pedidosComerciante.mockResolvedValue([
      pedido({
        reporteAbierto: {
          id_reporte: 3,
          motivo: 'Otro motivo',
          estado_reporte: 'PENDIENTE_REVISION',
          fecha_reporte: '2026-01-02T00:00:00.000Z',
        },
      }),
    ]);
    renderPanel();
    await screen.findByText('Pedido MC-2');

    expect(
      screen.queryByRole('button', { name: 'Reportar problema' }),
    ).toBeNull();
    expect(
      screen.getByText(/Ya enviaste un reporte para este pedido/),
    ).toBeTruthy();
  });

  it('advierte si el reporte se guardó pero no se notificó a soporte', async () => {
    mocks.crear.mockResolvedValue({
      id_reporte: 10,
      motivo: 'Cancelación indebida en mostrador',
      descripcion: null,
      estado_reporte: 'PENDIENTE_REVISION',
      tipo_destino: 'CLIENTE',
      fecha_reporte: '2026-01-02T00:00:00.000Z',
      notificacionSoporte: {
        enviada: false,
        destinatarios: 0,
        aviso: 'SMTP caído',
      },
    });
    renderPanel();
    await screen.findByText('Pedido MC-2');

    await elegirMotivo('Cancelación indebida en mostrador');
    fireEvent.click(screen.getByRole('button', { name: 'Reportar problema' }));

    await waitFor(() =>
      expect(mocks.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Reporte enviado; soporte no notificado',
          message: 'SMTP caído',
        }),
      ),
    );
  });
});
