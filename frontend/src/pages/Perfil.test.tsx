import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Perfil } from './Perfil';

const mocks = vi.hoisted(() => ({
  perfil: vi.fn(),
  cambiarPassword: vi.fn(),
  olvidarPassword: vi.fn(),
  cerrarSesion: vi.fn(),
  actualizarUsuario: vi.fn(),
  notificar: vi.fn(),
}));

vi.mock('../api', () => ({
  ApiError: class ApiError extends Error {},
  authApi: {
    cambiarPassword: mocks.cambiarPassword,
    olvidarPassword: mocks.olvidarPassword,
  },
  usuariosApi: { perfil: mocks.perfil },
  direccionesApi: {},
  bajasApi: {},
}));

vi.mock('../auth/contexto', () => ({
  useAuth: () => ({
    token: 'token',
    cerrarSesion: mocks.cerrarSesion,
    actualizarUsuario: mocks.actualizarUsuario,
  }),
}));

vi.mock('@mantine/notifications', () => ({
  notifications: { show: mocks.notificar },
}));

vi.mock('../components/BuscadorDireccion', () => ({
  BuscadorDireccion: () => null,
}));

vi.mock('../components/MapaUbicacion', () => ({
  MapaUbicacion: () => null,
}));

function renderizar() {
  return render(
    <MantineProvider>
      <MemoryRouter>
        <Perfil />
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe('Perfil · cambio de contraseña', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.perfil.mockResolvedValue({
      id: 'u1',
      dni: '12345678',
      nombre: 'Ana',
      apellido: 'Paz',
      email: 'ana@test.com',
      telefono: '2900111222',
      fechaNacimiento: '1990-01-01',
      rol: 'CLIENTE',
      estado: 'HABILITADO',
      createdAt: '2026-01-01T00:00:00.000Z',
      direcciones: [],
    });
    mocks.cambiarPassword.mockResolvedValue({
      message: 'Contraseña actualizada correctamente.',
    });
  });

  it('valida y envía el cambio de contraseña desde Seguridad', async () => {
    renderizar();

    await screen.findByRole('heading', { name: /Mi Perfil y Configuración/ });

    fireEvent.click(
      screen.getByRole('button', { name: 'Cambiar contraseña' }),
    );

    fireEvent.change(screen.getByLabelText('Contraseña actual'), {
      target: { value: 'Actual12345' },
    });
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), {
      target: { value: 'Nueva12345' },
    });
    fireEvent.change(screen.getByLabelText('Repetir nueva contraseña'), {
      target: { value: 'Nueva12345' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar clave' }));

    await waitFor(() => {
      expect(mocks.cambiarPassword).toHaveBeenCalledWith(
        'token',
        'Actual12345',
        'Nueva12345',
      );
    });
    expect(mocks.cerrarSesion).toHaveBeenCalled();
  });

  it('muestra un error si las contraseñas nuevas no coinciden', async () => {
    renderizar();

    await screen.findByRole('heading', { name: /Mi Perfil y Configuración/ });

    fireEvent.click(
      screen.getByRole('button', { name: 'Cambiar contraseña' }),
    );

    fireEvent.change(screen.getByLabelText('Contraseña actual'), {
      target: { value: 'Actual12345' },
    });
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), {
      target: { value: 'Nueva12345' },
    });
    fireEvent.change(screen.getByLabelText('Repetir nueva contraseña'), {
      target: { value: 'Otra12345' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar clave' }));

    expect(
      await screen.findByText('Las contraseñas nuevas no coinciden'),
    ).toBeInTheDocument();
    expect(mocks.cambiarPassword).not.toHaveBeenCalled();
  });
});
