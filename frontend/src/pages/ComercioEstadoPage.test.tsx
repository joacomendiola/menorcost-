import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { EstadoUsuario } from '../api';
import { ComercioEstadoPage } from './ComercioEstadoPage';

const useAuthMock = vi.fn();
vi.mock('../auth/contexto', () => ({
  useAuth: () => useAuthMock(),
}));

const mioMock = vi.fn();
vi.mock('../comercios/api', () => ({
  comerciosApi: {
    mio: (...args: unknown[]) => mioMock(...args),
  },
}));

function sesion(estado: EstadoUsuario) {
  return {
    usuario: {
      id: 'u1',
      nombre: 'Ana',
      apellido: 'Paz',
      email: 'ana@test.com',
      rol: 'COMERCIANTE',
      estado,
    },
    token: 'token',
    cargando: false,
    cerrarSesion: vi.fn(),
    iniciarSesion: vi.fn(),
    registrarSesion: vi.fn(),
    actualizarUsuario: vi.fn(),
  };
}

function renderizar() {
  return render(
    <MantineProvider>
      <MemoryRouter>
        <ComercioEstadoPage />
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe('ComercioEstadoPage (P10)', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    mioMock.mockReset();
  });

  it('muestra el estado pendiente y la documentación a enviar', async () => {
    useAuthMock.mockReturnValue(sesion('PENDIENTE_VERIFICACION'));
    mioMock.mockResolvedValue({ estado: 'PENDIENTE_VERIFICACION' });

    renderizar();

    expect(
      await screen.findByRole('heading', {
        name: 'Tu comercio está en revisión',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('PENDIENTE_VERIFICACION')).toBeInTheDocument();
    expect(screen.getAllByText('Pendiente')).toHaveLength(4);
    expect(screen.getByText('Documentación a enviar')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Revisar mis datos' }),
    ).toBeInTheDocument();
  });

  it('muestra el rechazo con documentos observados', async () => {
    useAuthMock.mockReturnValue(sesion('DOCUMENTACION_RECHAZADA'));
    mioMock.mockResolvedValue({ estado: 'DOCUMENTACION_RECHAZADA' });

    renderizar();

    expect(
      await screen.findByRole('heading', {
        name: 'Tu comercio necesita correcciones',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('RECHAZADO')).toBeInTheDocument();
    expect(screen.getAllByText('Observada')).toHaveLength(4);
    expect(
      screen.getByText(/La documentación fue observada/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Corregir y reenviar' }),
    ).toBeInTheDocument();
  });

  it('muestra el estado suspendido', async () => {
    useAuthMock.mockReturnValue(sesion('SUSPENDIDO'));
    mioMock.mockResolvedValue({ estado: 'SUSPENDIDO' });

    renderizar();

    expect(
      await screen.findByRole('heading', {
        name: 'Tu comercio está suspendido',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('SUSPENDIDO')).toBeInTheDocument();
  });

  it('redirige al panel cuando la cuenta ya está habilitada', async () => {
    useAuthMock.mockReturnValue(sesion('HABILITADO'));
    mioMock.mockResolvedValue({ estado: 'HABILITADO' });

    render(
      <MantineProvider>
        <MemoryRouter initialEntries={['/comercio/estado']}>
          <Routes>
            <Route path="/comercio/estado" element={<ComercioEstadoPage />} />
            <Route path="/panel" element={<div>PANEL COMERCIANTE</div>} />
          </Routes>
        </MemoryRouter>
      </MantineProvider>,
    );

    expect(await screen.findByText('PANEL COMERCIANTE')).toBeInTheDocument();
  });
});
