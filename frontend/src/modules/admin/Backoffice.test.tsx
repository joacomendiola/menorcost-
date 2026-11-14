// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter, Route, Routes, useLocation, useOutletContext } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Backoffice } from './Backoffice';
import type { AdminKpis } from '../../api';

const mocks = vi.hoisted(() => ({
  kpis: vi.fn(),
  cerrarSesion: vi.fn(),
}));

vi.mock('../../api', () => ({
  adminApi: { kpis: mocks.kpis },
  ApiError: class ApiError extends Error {},
}));

vi.mock('../../auth/contexto', () => ({
  useAuth: () => ({ token: 'token', cerrarSesion: mocks.cerrarSesion }),
}));

const kpis: AdminKpis = {
  altasPendientes: 4,
  altasAprobadas30Dias: 2,
  bajasSolicitadas: 3,
  denunciasAbiertas: 1,
};

function Probe() {
  const { search, estado } = useOutletContext<{
    search: string;
    estado: string;
  }>();
  const location = useLocation();

  return (
    <div data-testid="probe">
      {location.pathname}|{search}|{estado}
    </div>
  );
}

function renderBackoffice(initialEntry = '/admin/altas') {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/admin" element={<Backoffice />}>
            <Route path="altas" element={<Probe />} />
            <Route path="bajas" element={<Probe />} />
            <Route path="denuncias" element={<Probe />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </MantineProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.kpis.mockResolvedValue(kpis);
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

describe('Backoffice', () => {
  it('muestra los KPIs y los contadores de las pestañas', async () => {
    renderBackoffice();

    await screen.findByText('Altas pendientes');
    expect(screen.getByText('Altas pendientes').previousElementSibling).toHaveTextContent('4');
    expect(
      screen.getByText('Altas aprobadas (30 días)').previousElementSibling,
    ).toHaveTextContent('2');
    expect(
      screen.getByText('Bajas solicitadas').previousElementSibling,
    ).toHaveTextContent('3');
    expect(
      screen.getByText('Denuncias abiertas').previousElementSibling,
    ).toHaveTextContent('1');
    expect(mocks.kpis).toHaveBeenCalledWith('token');
  });

  it('navega entre pestañas y aplica el estado por defecto de cada una', async () => {
    renderBackoffice();
    await screen.findByTestId('probe');
    expect(screen.getByTestId('probe')).toHaveTextContent(
      '/admin/altas||PENDIENTE_VERIFICACION',
    );

    fireEvent.click(screen.getByRole('button', { name: /Bajas de cuentas/ }));

    await waitFor(() =>
      expect(screen.getByTestId('probe')).toHaveTextContent(
        '/admin/bajas||PENDIENTE',
      ),
    );
  });

  it('aplica debounce al buscar y usa el texto recortado', async () => {
    renderBackoffice();
    await screen.findByTestId('probe');

    fireEvent.change(screen.getByLabelText('Buscar'), {
      target: { value: '  ana  ' },
    });

    await waitFor(
      () =>
        expect(screen.getByTestId('probe')).toHaveTextContent(
          '/admin/altas|ana|PENDIENTE_VERIFICACION',
        ),
      { timeout: 1500 },
    );
  });

  it('actualiza el estado seleccionado en el contexto', async () => {
    renderBackoffice();
    await screen.findByTestId('probe');

    fireEvent.click(
      screen.getByRole('combobox', { name: 'Filtrar por estado' }),
    );
    fireEvent.click(await screen.findByText('Habilitados'));

    await waitFor(() =>
      expect(screen.getByTestId('probe')).toHaveTextContent(
        '/admin/altas||HABILITADO',
      ),
    );
  });

  it('permite reintentar la carga de KPIs cuando falla', async () => {
    mocks.kpis
      .mockRejectedValueOnce(new Error('API caída'))
      .mockResolvedValueOnce(kpis);
    renderBackoffice();

    await screen.findByText(/No pudimos actualizar los indicadores/);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => expect(mocks.kpis).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        screen.getByText('Altas pendientes').previousElementSibling,
      ).toHaveTextContent('4'),
    );
  });
});
