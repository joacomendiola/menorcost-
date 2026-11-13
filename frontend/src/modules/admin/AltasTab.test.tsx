// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AltasTab } from './AltasTab';

const mocks = vi.hoisted(() => ({
  recargar: vi.fn(),
  refrescarKpis: vi.fn(),
  aprobarAlta: vi.fn(),
  rechazarAlta: vi.fn(),
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
    estado: 'PENDIENTE_VERIFICACION',
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
    rol: 'COMERCIANTE',
    estado: 'PENDIENTE_VERIFICACION',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    direcciones: [],
    comercio: null,
  };

  return {
    useAdminList: () => ({
      items: [
        {
          idComercio: 'c1',
          usuarioId: 'u1',
          mercadoPagoVinculado: true,
          reputacionPromedio: 4.5,
          totalCalificaciones: 2,
          nombreFantasia: 'Local',
          razonSocial: 'Local SRL',
          cuit: '20-12345678-9',
          telefono: '123',
          descripcion: null,
          calle: 'Calle',
          numero: '123',
          piso: null,
          localidad: 'CABA',
          provincia: 'Buenos Aires',
          codigoPostal: '1000',
          latitud: -34.6,
          longitud: -58.4,
          estado: 'PENDIENTE_VERIFICACION',
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
        <button type="button" onClick={() => onConfirm('CUIT inexistente')}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.aprobarAlta.mockResolvedValue({
    notificacion: { enviada: true },
  });
  mocks.rechazarAlta.mockResolvedValue({
    notificacion: { enviada: true },
  });
});

describe('AltasTab', () => {
  it('aprueba un alta y refresca los indicadores', async () => {
    render(
      <MantineProvider>
        <AltasTab />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Aprobar alta/ }));

    await waitFor(() =>
      expect(mocks.aprobarAlta).toHaveBeenCalledWith('token', 'c1'),
    );
    await waitFor(() =>
      expect(screen.getByText(/pasó a HABILITADO/)).toBeTruthy(),
    );
    expect(mocks.refrescarKpis).toHaveBeenCalled();
    expect(mocks.recargar).toHaveBeenCalled();
  });

  it('rechaza un alta con el motivo indicado', async () => {
    render(
      <MantineProvider>
        <AltasTab />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Rechazar alta' }));

    await waitFor(() =>
      expect(mocks.rechazarAlta).toHaveBeenCalledWith(
        'token',
        'c1',
        'CUIT inexistente',
      ),
    );
    await waitFor(() =>
      expect(screen.getByText(/DOCUMENTACION_RECHAZADA/)).toBeTruthy(),
    );
  });
});
