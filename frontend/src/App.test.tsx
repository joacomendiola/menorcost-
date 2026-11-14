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

function renderizar(entrada: string) {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={[entrada]}>
        <App />
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe('Rutas de cliente pendientes', () => {
  it.each([
    ['/mis-pedidos', 'Mis pedidos'],
    ['/buscar', 'Buscar ofertas'],
  ])('%s muestra el componente EnConstruccion', (ruta, titulo) => {
    renderizar(ruta);

    expect(
      screen.getByRole('heading', { level: 1, name: titulo }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        'Esta sección estará disponible en el próximo módulo.',
      ),
    ).toBeInTheDocument();
  });
});
