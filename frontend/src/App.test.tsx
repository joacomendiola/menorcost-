import { describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

vi.mock('./auth/contexto', () => ({
  useAuth: () => ({
    usuario: {
      id: 'u1',
      nombre: 'Ana',
      apellido: 'Paz',
      email: 'ana@test.com',
      rol: 'CLIENTE',
      estado: 'HABILITADO',
    },
    token: 'token',
    cargando: false,
    cerrarSesion: vi.fn(),
    iniciarSesion: vi.fn(),
    registrarSesion: vi.fn(),
    actualizarUsuario: vi.fn(),
  }),
}));

vi.mock('./components/TopBar', () => ({
  TopBar: () => <header>TOPBAR</header>,
}));

vi.mock('./modules/orders/MisPedidosPage', () => ({
  MisPedidosPage: () => <h1>Mis pedidos</h1>,
}));

function renderizar(entrada: string) {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={[entrada]}>
        <App />
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe('Rutas de restablecimiento de contraseña', () => {
  it('/restablecer muestra el formulario aunque haya una sesión activa', () => {
    renderizar('/restablecer?token=test-token');

    expect(
      screen.getByRole('heading', { level: 2, name: 'Nueva contraseña' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nueva contraseña')).toBeInTheDocument();
    expect(screen.getByLabelText('Repetir contraseña')).toBeInTheDocument();
  });
});

describe('Rutas de cliente', () => {
  it('/mis-pedidos muestra la página de pedidos', () => {
    renderizar('/mis-pedidos');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Mis pedidos' }),
    ).toBeInTheDocument();
  });
});
