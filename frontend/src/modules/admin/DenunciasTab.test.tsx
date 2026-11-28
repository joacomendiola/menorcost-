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

const mocks = vi.hoisted(() => {
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
    recargar: vi.fn(),
    refrescarKpis: vi.fn(),
    desestimarDenuncia: vi.fn(),
    resolverDenuncia: vi.fn(),
    sancionarDenuncia: vi.fn(),
    toggleInvestigacion: vi.fn(),
    rehabilitarUsuario: vi.fn(),
    items: [
      {
        id_reporte: 7,
        motivo: 'Producto en mal estado',
        descripcion: null,
        estado_reporte: 'PENDIENTE_REVISION',
        tipo_destino: 'COMERCIO',
        fecha_reporte: '2026-01-01T00:00:00.000Z',
        fecha_resolucion: null as string | null,
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
  };
});

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

vi.mock('./useAdminList', () => ({
  useAdminList: () => ({
    items: mocks.items,
    cargando: false,
    error: null,
    recargar: mocks.recargar,
  }),
}));

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
    titulo: string;
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
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.items[0].estado_reporte = 'PENDIENTE_REVISION';
  mocks.items[0].fecha_resolucion = null;
  mocks.items[0].admin = null;
  mocks.items[0].denunciado.estado = 'BAJO_INVESTIGACION';
  mocks.items[0].registro.abiertas = 1;
  mocks.sancionarDenuncia.mockResolvedValue({
    reporte: { id_reporte: 7, estado_reporte: 'RESUELTO' },
    usuario: mocks.items[0].denunciado,
    denunciasCerradas: 0,
    notificacion: { enviada: true },
    notificacionEmisor: { enviada: true },
  });
  mocks.desestimarDenuncia.mockResolvedValue({
    success: true,
    notificaciones: {
      emisor: { enviada: true },
      denunciado: { enviada: true },
    },
  });
  mocks.rehabilitarUsuario.mockResolvedValue({ success: true });
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

  it('oculta la rehabilitación de una cuenta bajo investigación con reportes abiertos', () => {
    render(
      <MantineProvider>
        <DenunciasTab />
      </MantineProvider>,
    );

    expect(
      screen.queryByRole('button', { name: 'Rehabilitar cuenta' }),
    ).toBeNull();
  });

  it('rehabilita una cuenta bajo investigación cuando ya no tiene reportes abiertos', async () => {
    mocks.items[0].estado_reporte = 'RESUELTO';
    mocks.items[0].registro.abiertas = 0;

    render(
      <MantineProvider>
        <DenunciasTab />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Rehabilitar cuenta' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar rehabilitación' }),
    );

    await waitFor(() =>
      expect(mocks.rehabilitarUsuario).toHaveBeenCalledWith('token', 'u2'),
    );
    await waitFor(() =>
      expect(
        screen.getByText(/volvió a estado HABILITADO/),
      ).toBeTruthy(),
    );
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

  it('muestra la fecha de resolución de una denuncia cerrada', () => {
    mocks.items[0].estado_reporte = 'RESUELTO';
    mocks.items[0].fecha_resolucion = '2026-02-03T12:00:00.000Z';

    render(
      <MantineProvider>
        <DenunciasTab />
      </MantineProvider>,
    );

    expect(screen.getByText('Fecha de resolución')).toBeTruthy();
    expect(screen.getByText('03/02/2026')).toBeTruthy();
  });

  it('ofrece resolver sin sanción en las denuncias pendientes', () => {
    render(
      <MantineProvider>
        <DenunciasTab />
      </MantineProvider>,
    );

    expect(
      screen.getByRole('button', { name: 'Resolver sin sanción' }),
    ).toBeTruthy();
  });

  it('da de baja la publicación reportada', async () => {
    mocks.sancionarDenuncia.mockResolvedValue({
      reporte: { id_reporte: 7, estado_reporte: 'RESUELTO' },
      productosEliminados: 2,
      notificacion: { enviada: true },
      notificacionEmisor: { enviada: true },
    });

    render(
      <MantineProvider>
        <DenunciasTab />
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sancionar' }));
    fireEvent.click(
      screen.getByLabelText('Dar de baja la publicación reportada'),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Dar de baja publicación' }),
    );

    await waitFor(() =>
      expect(mocks.sancionarDenuncia).toHaveBeenCalledWith(
        'token',
        7,
        'PUBLICACION',
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByText(/Se dieron de baja 2 publicación/),
      ).toBeTruthy(),
    );
  });
});
