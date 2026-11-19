import { afterEach, describe, expect, it, vi } from 'vitest';
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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('/mis-pedidos muestra el historial de pedidos', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    renderizar('/mis-pedidos');
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

describe('Rutas de cliente pendientes', () => {
  it('/mis-pedidos muestra el componente EnConstruccion', () => {
    const ruta = '/mis-pedidos';
    renderizar(ruta);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Mis pedidos' }),
    ).toBeInTheDocument();

    expect(
      await screen.findByText('Todavía no tenés pedidos'),
    ).toBeInTheDocument();
  });
});
