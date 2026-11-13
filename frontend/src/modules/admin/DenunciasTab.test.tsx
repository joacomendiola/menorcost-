// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DenunciasTab } from './DenunciasTab';

const mocks = vi.hoisted(() => ({
  recargar: vi.fn(),
  refrescarKpis: vi.fn(),
  desestimarDenuncia: vi.fn(),
  resolverDenuncia: vi.fn(),
  sancionarDenuncia: vi.fn(),
  toggleInvestigacion: vi.fn(),
  rehabilitarUsuario: vi.fn(),
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
    estado: 'ABIERTAS',
    refrescarKpis: mocks.refrescarKpis,
  }),
}));

vi.mock('./useAdminList', () => {
  const usuario = {
    id: 'u1',
    nombre: 'Ana',
    apellido: 'Pérez',
    email: 'ana@example.com',
    dni: '12345678',
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
          id_reporte: 7,
          motivo: 'Producto en mal estado',
          descripcion: null,
          estado_reporte: 'PENDIENTE_REVISION',
          tipo_destino: 'COMERCIO',
          fecha_reporte: '2026-01-01T00:00:00.000Z',
          fecha_resolucion: null,
          id_pedido: 'p1',
          id_emisor: 'u1',
          id_denunciado: 'u2',
          id_admin: null,
          pedido: null,
          emisor: usuario,
          denunciado: {
            ...usuario,
            id: 'u2',
            nombre: 'Luis',
            apellido: 'Gómez',
            estado: 'BAJO_INVESTIGACION',
          },
          admin: null,
          registro: {
            total: 1,
            abiertas: 1,
            resueltas: 0,
            desestimadas: 0,
          },
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
    acciones,
  }: {
    titulo: string;
    acciones?: ReactNode;
  }) => (
    <section>
      <h2>{titulo}</h2>
      {acciones}
    </section>
  ),
  AdminLista: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AdminResult: ({ children }: { children: ReactNode }) => (
    <div role="status">{children}</div>
  ),
  AdminRows: () => null,
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
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.desestimarDenuncia.mockResolvedValue({
    success: true,
    notificaciones: {
      emisor: { enviada: true },
      denunciado: { enviada: true },
    },
  });
});

describe('DenunciasTab', () => {
  it('desestima una denuncia y avisa que se notificó a ambas partes', async () => {
    render(
      <MantineProvider>
        <DenunciasTab />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Desestimar' }));
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Desestimar denuncia' }),
    );

    await waitFor(() =>
      expect(mocks.desestimarDenuncia).toHaveBeenCalledWith('token', 7),
    );
    await waitFor(() =>
      expect(
        screen.getByText(/Se notificó a ambas partes por correo/),
      ).toBeTruthy(),
    );
    expect(mocks.refrescarKpis).toHaveBeenCalled();
    expect(mocks.recargar).toHaveBeenCalled();
  });

  it('advierte cuando no se pudo notificar al emisor', async () => {
    mocks.desestimarDenuncia.mockResolvedValue({
      success: true,
      notificaciones: {
        emisor: { enviada: false, aviso: 'SMTP caído' },
        denunciado: { enviada: true },
      },
    });

    render(
      <MantineProvider>
        <DenunciasTab />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Desestimar' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Desestimar denuncia' }),
    );

    await waitFor(() =>
      expect(screen.getByText(/No se pudo notificar a: emisor/)).toBeTruthy(),
    );
  });
});
