// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BajasTab } from './BajasTab';

const mocks = vi.hoisted(() => ({
  recargar: vi.fn(),
  refrescarKpis: vi.fn(),
  aprobarBaja: vi.fn(),
  rechazarBaja: vi.fn(),
}));

vi.mock('../../api', () => ({
  adminApi: mocks,
  ApiError: class ApiError extends Error {},
}));

vi.mock('../../auth/contexto', () => ({
  useAuth: () => ({ token: 'token', cerrarSesion: vi.fn() }),
}));

vi.mock('./adminContext', () => ({
  useAdminContext: () => ({
    search: '',
    estado: 'PENDIENTE',
    refrescarKpis: mocks.refrescarKpis,
  }),
}));

vi.mock('./useAdminList', () => {
  const usuario = {
    id: 'u1',
    dni: '20123456',
    nombre: 'Ana',
    apellido: 'Pérez',
    email: 'ana@example.com',
    telefono: '123',
    rol: 'CLIENTE',
    estado: 'HABILITADO',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    comercio: null,
  };

  return {
    useAdminList: () => ({
      items: [
        {
          id: 'b1',
          usuarioId: 'u1',
          motivo: 'Viaje',
          estado: 'PENDIENTE',
          observaciones: null,
          resueltoEn: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          pedidosCompletados: 3,
          saldoTarifas: 0,
          usuario,
        },
      ],
      cargando: false,
      error: null,
      recargar: mocks.recargar,
    }),
  };
});

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}));

vi.mock('./AdminUI', () => ({
  AdminEmpty: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AdminItem: ({
    titulo,
    detalle,
    acciones,
  }: {
    titulo: ReactNode;
    detalle?: ReactNode;
    acciones?: ReactNode;
  }) => (
    <section>
      <h2>{titulo}</h2>
      {detalle}
      {acciones}
    </section>
  ),
  AdminLista: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AdminResult: ({ children }: { children: ReactNode }) => (
    <div role="status">{children}</div>
  ),
  AdminRows: ({
    rows,
  }: {
    rows: Array<{ label: string; value: ReactNode }>;
  }) => (
    <dl>
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  ),
  AdminSkeleton: () => <div>cargando</div>,
  ConfirmDialog: ({
    open,
    children,
    confirmLabel,
    onConfirm,
  }: {
    open: boolean;
    children: ReactNode;
    confirmLabel: string;
    onConfirm: () => void;
  }) =>
    open ? (
      <div role="dialog">
        <div>{children}</div>
        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
  MotivoDialog: ({
    open,
    confirmLabel,
    onConfirm,
  }: {
    open: boolean;
    confirmLabel: string;
    onConfirm: (valor: string) => void;
  }) =>
    open ? (
      <div role="dialog">
        <button type="button" onClick={() => onConfirm('Motivo de prueba')}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.aprobarBaja.mockResolvedValue({ message: 'ok' });
  mocks.rechazarBaja.mockResolvedValue({ message: 'ok' });
});

describe('BajasTab', () => {
  it('muestra que el saldo no está disponible en lugar de afirmar que es cero', () => {
    render(
      <MantineProvider>
        <BajasTab />
      </MantineProvider>,
    );

    expect(screen.getByText('No disponible')).toBeTruthy();
  });

  it('aprueba una baja y refresca los indicadores', async () => {
    render(
      <MantineProvider>
        <BajasTab />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Aprobar baja/ }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Aprobar baja',
      }),
    );

    await waitFor(() =>
      expect(mocks.aprobarBaja).toHaveBeenCalledWith('token', 'b1'),
    );
    await waitFor(() =>
      expect(screen.getByText(/Baja aprobada/)).toBeTruthy(),
    );
    expect(mocks.refrescarKpis).toHaveBeenCalled();
    expect(mocks.recargar).toHaveBeenCalled();
  });

  it('rechaza una baja con las observaciones indicadas', async () => {
    render(
      <MantineProvider>
        <BajasTab />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Rechazar baja' }));
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Rechazar baja',
      }),
    );

    await waitFor(() =>
      expect(mocks.rechazarBaja).toHaveBeenCalledWith(
        'token',
        'b1',
        'Motivo de prueba',
      ),
    );
    await waitFor(() =>
      expect(screen.getByText(/Baja rechazada/)).toBeTruthy(),
    );
  });
});
