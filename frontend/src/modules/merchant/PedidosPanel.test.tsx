// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { PedidosPanel } from './PedidosPanel';
import type { PedidoReportableComerciante } from '../../api';

const mocks = vi.hoisted(() => ({
  pedidosComerciante: vi.fn(),
  crear: vi.fn(),
  show: vi.fn(),
  cerrarSesion: vi.fn(),
  comercio: vi.fn(),
  validarEntrega: vi.fn(),
  entregar: vi.fn(),
  cancelar: vi.fn(),
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
  pedidosApi: {
    comercio: mocks.comercio,
    validarEntrega: mocks.validarEntrega,
    entregar: mocks.entregar,
    cancelar: mocks.cancelar,
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

/** Igual que `renderPanel`, pero como monta la app real (`main.tsx`). */
function renderPanelEnStrictMode() {
  return render(
    <StrictMode>
      <MantineProvider>
        <PedidosPanel />
      </MantineProvider>
    </StrictMode>,
  );
}

async function elegirMotivo(label: string) {
  fireEvent.click(screen.getByRole('combobox'));
  fireEvent.click(await screen.findByText(label));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pedidosComerciante.mockResolvedValue([pedido()]);
  mocks.comercio.mockResolvedValue([]);
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

  it('no rompe el panel al escribir en la descripción del reporte', async () => {
    // StrictMode re-invoca los updaters de estado; antes, leer
    // `evento.currentTarget` dentro del updater devolvía null y tumbaba la app.
    renderPanelEnStrictMode();
    await screen.findByText('Pedido MC-2');

    await elegirMotivo('Otro motivo');
    const descripcion = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Descripción del problema',
    });

    fireEvent.change(descripcion, { target: { value: 'L' } });

    expect(screen.getByText('Pedido MC-2')).toBeTruthy();
    expect(descripcion.value).toBe('L');
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

  it('valida el código y confirma la entrega en mostrador', async () => {
    mocks.validarEntrega.mockResolvedValue({
      pedido: {
        idPedido: 'p1',
        codigoAlfanumerico: 'MC-1',
        estado: 'PENDIENTE_DE_RETIRO',
        fechaPedido: '2026-01-01T00:00:00.000Z',
        fechaEntrega: null,
        total: 1500,
        cliente: { nombre: 'Ana', apellido: 'Paz' },
        pagoEstado: 'PAGADO',
        items: [{ titulo: 'Producto', cantidad: 1 }],
      },
      puedeEntregar: true,
      motivo: null,
    });
    mocks.entregar.mockResolvedValue({
      idPedido: 'p1',
      estado: 'ENTREGADO',
      yaEntregado: false,
    });

    renderPanel();
    fireEvent.change(screen.getByLabelText('Código del pedido'), {
      target: { value: 'MC-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Validar código' }));

    await screen.findByRole('button', { name: 'Confirmar entrega' });
    expect(mocks.validarEntrega).toHaveBeenCalledWith('token', 'MC-1');
    // La spec exige badges con color y el bloque de cobro destacado.
    expect(screen.getByText('Pendiente de retiro')).toBeTruthy();
    expect(screen.getByText('Cobro')).toBeTruthy();
    expect(screen.getByText('Pagado')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }));

    await waitFor(() =>
      expect(mocks.entregar).toHaveBeenCalledWith('token', 'p1'),
    );
    expect(mocks.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Entrega confirmada' }),
    );
  });

  it('no permite entregar si el pago no está aprobado', async () => {
    mocks.validarEntrega.mockResolvedValue({
      pedido: {
        idPedido: 'p1',
        codigoAlfanumerico: 'MC-1',
        estado: 'PENDIENTE_DE_RETIRO',
        fechaPedido: '2026-01-01T00:00:00.000Z',
        fechaEntrega: null,
        total: 1500,
        cliente: null,
        pagoEstado: 'PENDIENTE',
        items: [],
      },
      puedeEntregar: false,
      motivo: 'El pedido no tiene un pago aprobado.',
    });

    renderPanel();
    fireEvent.change(screen.getByLabelText('Código del pedido'), {
      target: { value: 'MC-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Validar código' }));

    await screen.findByText('El pedido no tiene un pago aprobado.');
    expect(
      screen.queryByRole('button', { name: 'Confirmar entrega' }),
    ).toBeNull();
  });

  it('permite cancelar un pedido pendiente de pago', async () => {
    mocks.comercio.mockResolvedValue([
      {
        idPedido: 'p3',
        codigoAlfanumerico: 'MC-3',
        estado: 'PENDIENTE_PAGO',
        fechaPedido: '2026-01-01T00:00:00.000Z',
        fechaEntrega: null,
        total: 900,
        cliente: null,
        pagoEstado: 'PENDIENTE',
        items: [],
      },
    ]);
    mocks.cancelar.mockResolvedValue({
      idPedido: 'p3',
      estado: 'CANCELADO',
      stockRestaurado: true,
    });

    renderPanel();
    await screen.findByText('Pedidos pendientes de pago');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar pedido' }));

    await waitFor(() =>
      expect(mocks.cancelar).toHaveBeenCalledWith('token', 'p3'),
    );
    expect(mocks.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Pedido cancelado' }),
    );
  });
});
