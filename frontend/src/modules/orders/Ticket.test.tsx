// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Ticket } from './Ticket';
import { ApiError, type PedidoTicket } from '../../api';

const mocks = vi.hoisted(() => ({
  obtenerPorCodigo: vi.fn(),
  calificar: vi.fn(),
  crearReporte: vi.fn(),
  show: vi.fn(),
}));

vi.mock('../../api', () => ({
  ApiError: class ApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  pedidosApi: { obtenerPorCodigo: mocks.obtenerPorCodigo },
  reputacionApi: { calificar: mocks.calificar },
  reportesApi: { crear: mocks.crearReporte },
}));

vi.mock('../../auth/contexto', () => ({
  useAuth: () => ({ token: 'token', cargando: false }),
}));

vi.mock('@mantine/notifications', () => ({
  notifications: { show: mocks.show },
}));

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,qr'),
  },
}));

const pedidoBase: PedidoTicket = {
  idPedido: 'p1',
  codigoAlfanumerico: 'MC-1',
  codigoQR: 'qr-1',
  estado: 'ENTREGADO',
  fechaPedido: '2026-01-01T00:00:00.000Z',
  fechaEntrega: '2026-01-02T12:00:00.000Z',
  subtotal: 1000,
  tarifaServicio: 0,
  total: 1000,
  comercio: { idComercio: 'c1', nombre: 'Local' },
  franjaHorario: null,
  localAbierto: true,
  pagoEstado: 'PAGADO',
  items: [
    {
      id: 'i1',
      titulo: 'Producto',
      imagen: null,
      cantidad: 1,
      precioUnitario: 1000,
      subtotal: 1000,
    },
  ],
  calificacion: null,
  misReportes: [],
};

function pedido(overrides: Partial<PedidoTicket> = {}): PedidoTicket {
  return { ...pedidoBase, ...overrides };
}

function renderTicket() {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={['/pedido/MC-1']}>
        <Routes>
          <Route path="/pedido/:codigo" element={<Ticket />} />
        </Routes>
      </MemoryRouter>
    </MantineProvider>,
  );
}

async function elegirMotivo(label: string) {
  fireEvent.click(screen.getByRole('combobox'));
  fireEvent.click(await screen.findByText(label));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.obtenerPorCodigo.mockResolvedValue(pedido());
  mocks.calificar.mockResolvedValue({
    calificacion: {
      id_calificacion: 1,
      puntaje: 5,
      comentario: 'Excelente',
      fecha_creacion: '2026-01-02T00:00:00.000Z',
    },
    reputacionComercio: { promedio: 5, total: 1 },
  });
  mocks.crearReporte.mockResolvedValue({
    id_reporte: 9,
    motivo: 'El producto estaba en mal estado/era diferente',
    descripcion: null,
    estado_reporte: 'PENDIENTE_REVISION',
    tipo_destino: 'COMERCIO',
    fecha_reporte: '2026-01-02T00:00:00.000Z',
    notificacionSoporte: { enviada: true, destinatarios: 1 },
  });
});

afterEach(cleanup);

describe('Ticket · calificación', () => {
  it('envía una calificación con estrellas y comentario', async () => {
    renderTicket();
    await screen.findByText('MC-1');

    fireEvent.click(screen.getByRole('radio', { name: '5 estrellas' }));
    fireEvent.change(screen.getByLabelText('Comentario (opcional)'), {
      target: { value: 'Excelente' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar calificación' }));

    await waitFor(() =>
      expect(mocks.calificar).toHaveBeenCalledWith('token', {
        idPedido: 'p1',
        puntaje: 5,
        comentario: 'Excelente',
      }),
    );
    await screen.findByText(/Calificación enviada/);
    expect(mocks.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: '¡Gracias!' }),
    );
  });

  it('exige seleccionar una valoración antes de enviar', async () => {
    renderTicket();
    await screen.findByText('MC-1');

    fireEvent.click(screen.getByRole('button', { name: 'Enviar calificación' }));

    await waitFor(() =>
      expect(mocks.show).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Debes seleccionar una valoración entre 1 y 5 estrellas',
        }),
      ),
    );
    expect(mocks.calificar).not.toHaveBeenCalled();
  });

  it('limita el comentario a 250 caracteres y muestra el contador', async () => {
    renderTicket();
    await screen.findByText('MC-1');

    const textarea = screen.getByLabelText('Comentario (opcional)');
    expect(textarea).toHaveAttribute('maxlength', '250');

    fireEvent.change(textarea, { target: { value: 'Muy bien' } });
    expect(screen.getByText('8/250')).toBeTruthy();
  });

  it('no muestra el formulario de calificación si el pedido no fue entregado', async () => {
    mocks.obtenerPorCodigo.mockResolvedValue(
      pedido({ estado: 'PENDIENTE_DE_RETIRO' }),
    );
    renderTicket();
    await screen.findByText('MC-1');

    expect(screen.queryByText('Calificá tu pedido')).toBeNull();
    // El cliente solo puede reportar pedidos ya entregados (CU-2.06).
    expect(screen.queryByText('Reportar problema')).toBeNull();
  });

  it('muestra el resumen cuando el pedido ya fue calificado', async () => {
    mocks.obtenerPorCodigo.mockResolvedValue(
      pedido({
        calificacion: {
          id: 1,
          puntaje: 4,
          comentario: 'Muy bueno',
          fecha: '2026-01-02T00:00:00.000Z',
        },
      }),
    );
    renderTicket();
    await screen.findByText('MC-1');

    expect(screen.queryByRole('button', { name: 'Enviar calificación' })).toBeNull();
    expect(screen.getByText(/Calificación enviada/)).toBeTruthy();
  });

  it('informa cuando el backend rechaza una calificación duplicada', async () => {
    mocks.calificar.mockRejectedValue(
      new ApiError(409, 'Ya calificaste este pedido'),
    );
    renderTicket();
    await screen.findByText('MC-1');

    fireEvent.click(screen.getByRole('radio', { name: '5 estrellas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar calificación' }));

    await waitFor(() =>
      expect(mocks.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'No se pudo calificar',
          message: 'Ya calificaste este pedido',
        }),
      ),
    );
  });
});

describe('Ticket · reportes', () => {
  it('exige descripción cuando el motivo es "Otro"', async () => {
    renderTicket();
    await screen.findByText('MC-1');

    await elegirMotivo('Otro motivo');
    fireEvent.submit(
      screen.getByRole('button', { name: 'Enviar reporte' }).closest('form')!,
    );

    await waitFor(() =>
      expect(mocks.show).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Por favor, especifica brevemente el problema ocurrido',
        }),
      ),
    );
    expect(mocks.crearReporte).not.toHaveBeenCalled();
  });

  it('envía un reporte al comercio y actualiza el estado del ticket', async () => {
    renderTicket();
    await screen.findByText('MC-1');

    await elegirMotivo('El producto estaba en mal estado/era diferente');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }));

    await waitFor(() =>
      expect(mocks.crearReporte).toHaveBeenCalledWith('token', {
        idPedido: 'p1',
        motivo: 'El producto estaba en mal estado/era diferente',
        descripcion: undefined,
        tipo_destino: 'COMERCIO',
      }),
    );
    await screen.findByText(/Ya enviaste un reporte para este pedido/);
    expect(mocks.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Reporte enviado' }),
    );
  });

  it('no muestra el formulario si ya existe un reporte abierto', async () => {
    mocks.obtenerPorCodigo.mockResolvedValue(
      pedido({
        misReportes: [
          {
            id: 1,
            motivo: 'Otro',
            estado: 'PENDIENTE_REVISION',
            fecha: '2026-01-02T00:00:00.000Z',
          },
        ],
      }),
    );
    renderTicket();
    await screen.findByText('MC-1');

    expect(screen.queryByRole('button', { name: 'Enviar reporte' })).toBeNull();
    expect(screen.getByText(/Ya enviaste un reporte para este pedido/)).toBeTruthy();
  });

  it('advierte si el reporte se guardó pero no se notificó a soporte', async () => {
    mocks.crearReporte.mockResolvedValue({
      id_reporte: 9,
      motivo: 'El comercio estaba cerrado al ir a retirar',
      descripcion: null,
      estado_reporte: 'PENDIENTE_REVISION',
      tipo_destino: 'COMERCIO',
      fecha_reporte: '2026-01-02T00:00:00.000Z',
      notificacionSoporte: {
        enviada: false,
        destinatarios: 0,
        aviso: 'SMTP caído',
      },
    });
    renderTicket();
    await screen.findByText('MC-1');

    await elegirMotivo('El comercio estaba cerrado al ir a retirar');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }));

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
