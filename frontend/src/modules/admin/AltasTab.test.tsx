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

const altaMock = vi.hoisted(() => ({
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
  resueltoPorId: null as string | null,
  resueltoEn: null as string | null,
  motivoRechazo: null as string | null,
  resueltoPor: null as null | {
    id: string;
    nombre: string;
    apellido: string;
    email: string;
  },
  usuario: {
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
  },
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

vi.mock('./useAdminList', () => ({
  useAdminList: () => ({
    items: [altaMock],
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
    badges,
    detalle,
    acciones,
  }: {
    titulo: ReactNode;
    badges?: ReactNode;
    detalle?: ReactNode;
    acciones?: ReactNode;
  }) => (
    <section>
      <h2>{titulo}</h2>
      {badges}
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
  altaMock.estado = 'PENDIENTE_VERIFICACION';
  altaMock.usuario.estado = 'PENDIENTE_VERIFICACION';
  altaMock.resueltoPorId = null;
  altaMock.resueltoEn = null;
  altaMock.motivoRechazo = null;
  altaMock.resueltoPor = null;
  mocks.aprobarAlta.mockResolvedValue({
    notificacion: { enviada: true },
  });
  mocks.rechazarAlta.mockResolvedValue({
    notificacion: { enviada: true },
  });
});

describe('AltasTab', () => {
  it('muestra los indicadores disponibles y aclara que la documentación se revisa por correo', () => {
    render(
      <MantineProvider>
        <AltasTab />
      </MantineProvider>,
    );

    expect(screen.getByText('CUIT registrado')).toBeTruthy();
    expect(screen.getByText('Documentación por correo')).toBeTruthy();
    expect(screen.getByText('Constancia AFIP')).toBeTruthy();
    expect(screen.getByText('Habilitación municipal')).toBeTruthy();
    expect(screen.getByText('Estado AFIP')).toBeTruthy();
    expect(screen.getByText('Documentos adjuntos')).toBeTruthy();
  });

  it('muestra la resolución y el motivo de un alta rechazada', () => {
    altaMock.estado = 'DOCUMENTACION_RECHAZADA';
    altaMock.usuario.estado = 'DOCUMENTACION_RECHAZADA';
    altaMock.resueltoEn = '2026-01-02T00:00:00.000Z';
    altaMock.resueltoPor = {
      id: 'admin-1',
      nombre: 'Admin',
      apellido: 'Uno',
      email: 'admin@test.com',
    };
    altaMock.motivoRechazo = 'CUIT inexistente';

    render(
      <MantineProvider>
        <AltasTab />
      </MantineProvider>,
    );

    expect(screen.getByText('Resuelta')).toBeTruthy();
    expect(screen.getByText('Administrador')).toBeTruthy();
    expect(screen.getByText('Admin Uno')).toBeTruthy();
    expect(screen.getByText('Motivo de rechazo')).toBeTruthy();
    expect(screen.getByText('CUIT inexistente')).toBeTruthy();
  });

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
