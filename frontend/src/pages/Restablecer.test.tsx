import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Restablecer } from './Restablecer';

const mocks = vi.hoisted(() => ({
  restablecerPassword: vi.fn(),
  cerrarSesion: vi.fn(),
  notificar: vi.fn(),
}));

vi.mock('../api', () => ({
  ApiError: class ApiError extends Error {},
  authApi: { restablecerPassword: mocks.restablecerPassword },
}));

vi.mock('../auth/contexto', () => ({
  useAuth: () => ({ cerrarSesion: mocks.cerrarSesion }),
}));

vi.mock('@mantine/notifications', () => ({
  notifications: { show: mocks.notificar },
}));

function renderizar(entrada = '/restablecer?token=token-valido') {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={[entrada]}>
        <Restablecer />
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe('Restablecer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.restablecerPassword.mockResolvedValue({
      message: 'Contraseña actualizada correctamente.',
    });
  });

  it('restablece la contraseña y cierra la sesión local', async () => {
    renderizar();

    fireEvent.change(screen.getByLabelText('Nueva contraseña'), {
      target: { value: 'Nueva12345' },
    });
    fireEvent.change(screen.getByLabelText('Repetir contraseña'), {
      target: { value: 'Nueva12345' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Restablecer contraseña' }),
    );

    await waitFor(() => {
      expect(mocks.restablecerPassword).toHaveBeenCalledWith(
        'token-valido',
        'Nueva12345',
      );
    });
    expect(mocks.cerrarSesion).toHaveBeenCalled();
  });

  it('muestra el estado inválido cuando falta el token', () => {
    renderizar('/restablecer');

    expect(
      screen.getByText('Este enlace no es válido o está incompleto.'),
    ).toBeInTheDocument();
  });
});
