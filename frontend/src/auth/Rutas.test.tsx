import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { EstadoUsuario } from '../api';
import { RutaComerciante } from './Rutas';

const useAuthMock = vi.fn();
vi.mock('./contexto', () => ({
  useAuth: () => useAuthMock(),
}));

function sesion(rol: 'CLIENTE' | 'COMERCIANTE', estado: EstadoUsuario) {
  return {
    usuario: {
      id: 'u1',
      nombre: 'Ana',
      apellido: 'Paz',
      email: 'ana@test.com',
      rol,
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

function renderizar(entrada: string) {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={[entrada]}>
        <Routes>
          <Route element={<RutaComerciante />}>
            <Route path="/panel" element={<div>PANEL</div>} />
          </Route>
          <Route path="/comercio/estado" element={<div>ESTADO</div>} />
          <Route path="/perfil" element={<div>PERFIL</div>} />
        </Routes>
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe('RutaComerciante', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  it('redirige a /comercio/estado si el comercio no está habilitado', () => {
    useAuthMock.mockReturnValue(sesion('COMERCIANTE', 'PENDIENTE_VERIFICACION'));

    renderizar('/panel');

    expect(screen.getByText('ESTADO')).toBeInTheDocument();
  });

  it('redirige a /comercio/estado si la documentación fue rechazada', () => {
    useAuthMock.mockReturnValue(
      sesion('COMERCIANTE', 'DOCUMENTACION_RECHAZADA'),
    );

    renderizar('/panel');

    expect(screen.getByText('ESTADO')).toBeInTheDocument();
  });

  it('permite el acceso al panel cuando está habilitado', () => {
    useAuthMock.mockReturnValue(sesion('COMERCIANTE', 'HABILITADO'));

    renderizar('/panel');

    expect(screen.getByText('PANEL')).toBeInTheDocument();
  });

  it('redirige a /perfil si el rol no es comerciante', () => {
    useAuthMock.mockReturnValue(sesion('CLIENTE', 'HABILITADO'));

    renderizar('/panel');

    expect(screen.getByText('PERFIL')).toBeInTheDocument();
  });
});
