import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExplorarPage } from './ExplorarPage';

const mocks = vi.hoisted(() => ({ api: vi.fn(), listar: vi.fn() }));
vi.mock('../api', () => ({ api: mocks.api, direccionesApi: { listar: mocks.listar } }));
vi.mock('../auth/contexto', () => ({ useAuth: () => ({ token: 'token' }) }));
vi.mock('./MapaExploracion', () => ({
  MapaExploracion: () => <div data-testid="mapa-exploracion" />,
}));

describe('ExplorarPage', () => {
  beforeEach(() => {
    mocks.api.mockReset(); mocks.listar.mockReset().mockResolvedValue([]);
    mocks.api.mockImplementation((path: string) => path === '/categorias' ? Promise.resolve([]) : Promise.resolve([]));
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as typeof ResizeObserver;
  });

  it('muestra ofertas vacías con una sugerencia para ajustar criterios', async () => {
    render(<MantineProvider><MemoryRouter><ExplorarPage /></MemoryRouter></MantineProvider>);
    await waitFor(() => expect(screen.getByText('No hay ofertas disponibles en este momento.')).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Ofertas para vos' })).toBeInTheDocument();
  });

  it('carga catálogo público y direcciones del cliente', async () => {
    render(<MantineProvider><MemoryRouter><ExplorarPage /></MemoryRouter></MantineProvider>);
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith('/catalogo?'));
    expect(mocks.listar).toHaveBeenCalledWith('token');
  });

  it('desactiva la búsqueda vacía', () => {
    render(<MantineProvider><MemoryRouter><ExplorarPage /></MemoryRouter></MantineProvider>);
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeDisabled();
  });

  it('muestra el estado vacío del CU para productos y comercios', async () => {
    render(<MantineProvider><MemoryRouter initialEntries={['/buscar?q=leche']}><ExplorarPage /></MemoryRouter></MantineProvider>);
    expect(await screen.findByText('No encontramos resultados coincidentes. Intentá buscando por categoría o revisá la ortografía')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Productos coincidentes/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Comercios coincidentes/ })).toBeInTheDocument();
  });

  it('muestra el texto del CU para una categoría sin ofertas', async () => {
    mocks.api.mockImplementation((path: string) =>
      path === '/categorias'
        ? Promise.resolve([{ id: 'cat-1', nombre: 'Almacén', slug: 'almacen', subcategorias: [
            { id: 'cat-2', nombre: 'Lácteos', slug: 'lacteos', subcategorias: [] },
          ] }])
        : Promise.resolve([]),
    );
    render(<MantineProvider><MemoryRouter><ExplorarPage /></MemoryRouter></MantineProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Almacén' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Lácteos' })).not.toBeInTheDocument();
    screen.getByRole('button', { name: 'Almacén' }).click();
    expect(await screen.findByText('Actualmente no hay ofertas disponibles en esta categoría. Explorá otros rubros cercanos')).toBeInTheDocument();
  });

  it('ofrece limpiar filtros cuando no hay ofertas para los criterios aplicados', async () => {
    render(<MantineProvider><MemoryRouter><ExplorarPage /></MemoryRouter></MantineProvider>);
    await waitFor(() => expect(screen.getByText('No hay ofertas disponibles en este momento.')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    const minimum = await screen.findByLabelText('Precio mínimo');
    fireEvent.change(minimum, { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    expect(await screen.findByText('No hay ofertas que coincidan con todos los filtros aplicados')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    await waitFor(() => expect(screen.getByText('No hay ofertas disponibles en este momento.')).toBeInTheDocument());
  });
});
