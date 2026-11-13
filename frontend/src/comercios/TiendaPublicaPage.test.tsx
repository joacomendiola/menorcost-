import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TiendaPublicaPage } from './TiendaPublicaPage';

const mocks = vi.hoisted(() => ({ tienda: vi.fn() }));
vi.mock('./api', async (importOriginal) => {
  const original = await importOriginal<typeof import('./api')>();
  return {
    ...original,
    comerciosApi: { tienda: mocks.tienda },
  };
});
vi.mock('./MapaComercio', () => ({
  MapaComercio: () => <div data-testid="mapa-comercio" />,
}));

const tienda = {
  id: 'local-1',
  nombreFantasia: 'Almacén del Centro',
  descripcion: 'Ofertas del día',
  logoUrl: null,
  portadaUrl: null,
  calle: 'San Martín',
  numero: '1200',
  piso: null,
  localidad: 'Ushuaia',
  provincia: 'Tierra del Fuego',
  latitud: '-54.8',
  longitud: '-68.3',
  abierto: true,
  horarios: [],
  reputacion: 4.5,
  productos: [
    {
      id: 'leche',
      titulo: 'Leche entera',
      descripcion: 'Oferta de prueba',
      imagen: '',
      precioLista: 3000,
      precioPublico: 2400,
      fechaVencimiento: '2026-12-01',
      stock: 5,
      categoria: { nombre: 'Lácteos', slug: 'lacteos' },
    },
    {
      id: 'pan',
      titulo: 'Pan de campo',
      descripcion: 'Oferta de prueba',
      imagen: '',
      precioLista: 2500,
      precioPublico: 1800,
      fechaVencimiento: '2026-12-02',
      stock: 3,
      categoria: { nombre: 'Panadería', slug: 'panaderia' },
    },
  ],
};

describe('TiendaPublicaPage', () => {
  beforeEach(() => {
    mocks.tienda.mockReset().mockResolvedValue(tienda);
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as typeof ResizeObserver;
  });

  it('presenta categorías y filtra las ofertas del comercio', async () => {
    render(
      <MantineProvider>
        <MemoryRouter initialEntries={['/comercios/local-1']}>
          <Routes>
            <Route path="/comercios/:id" element={<TiendaPublicaPage />} />
          </Routes>
        </MemoryRouter>
      </MantineProvider>,
    );

    expect(await screen.findByText('Leche entera')).toBeInTheDocument();
    expect(screen.getByText('Pan de campo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lácteos' }));

    expect(screen.getByText('Leche entera')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText('Pan de campo')).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('mapa-comercio')).toBeInTheDocument();
  });
});
