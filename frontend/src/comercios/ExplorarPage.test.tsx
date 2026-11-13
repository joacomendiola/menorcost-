import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExplorarPage } from './ExplorarPage';

const mocks = vi.hoisted(() => ({ api: vi.fn(), listar: vi.fn() }));
vi.mock('../api', () => ({ api: mocks.api, direccionesApi: { listar: mocks.listar } }));
vi.mock('../auth/contexto', () => ({ useAuth: () => ({ token: 'token' }) }));

describe('ExplorarPage', () => {
  beforeEach(() => {
    mocks.api.mockReset(); mocks.listar.mockReset().mockResolvedValue([]);
    mocks.api.mockImplementation((path: string) => path === '/categorias' ? Promise.resolve([]) : Promise.resolve([]));
  });

  it('muestra ofertas vacías con una sugerencia para ajustar criterios', async () => {
    render(<MantineProvider><MemoryRouter><ExplorarPage /></MemoryRouter></MantineProvider>);
    await waitFor(() => expect(screen.getByText(/No encontramos ofertas/)).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Ofertas para vos' })).toBeInTheDocument();
  });

  it('carga catálogo público y direcciones del cliente', async () => {
    render(<MantineProvider><MemoryRouter><ExplorarPage /></MemoryRouter></MantineProvider>);
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith('/catalogo?'));
    expect(mocks.listar).toHaveBeenCalledWith('token');
  });
});
