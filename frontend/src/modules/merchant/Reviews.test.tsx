// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Reviews } from './Reviews';
import type { ReputacionComercio } from '../../api';

const mocks = vi.hoisted(() => ({
  obtenerMiReputacion: vi.fn(),
}));

vi.mock('../../api', () => ({
  reputacionApi: {
    obtenerMiReputacion: mocks.obtenerMiReputacion,
  },
}));

vi.mock('../../auth/contexto', () => ({
  useAuth: () => ({ token: 'token' }),
}));

const dataBase: ReputacionComercio = {
  promedio: 4.5,
  totalResenas: 2,
  distribucion: { '5': 1, '4': 1, '3': 0, '2': 0, '1': 0 },
  resenas: [
    {
      id: 1,
      clienteNombre: 'Ana Pérez',
      fecha: '2026-01-02T00:00:00.000Z',
      puntaje: 5,
      comentario: 'Excelente atención',
    },
    {
      id: 2,
      clienteNombre: 'Luis Gómez',
      fecha: '2026-01-01T00:00:00.000Z',
      puntaje: 4,
      comentario: null,
    },
  ],
  paginacion: { limit: 10, nextCursor: null, hasMore: false },
};

function renderReviews() {
  return render(
    <MantineProvider>
      <Reviews />
    </MantineProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.obtenerMiReputacion.mockResolvedValue(dataBase);
});

afterEach(cleanup);

describe('Reviews', () => {
  it('muestra el promedio, el total y las reseñas', async () => {
    renderReviews();

    await screen.findByText('Reseñas de clientes');
    expect(screen.getByText(/4,5/)).toBeTruthy();
    expect(screen.getByText(/2 reseñas verificadas/)).toBeTruthy();
    expect(screen.getByText('Ana Pérez')).toBeTruthy();
    expect(screen.getByText('Excelente atención')).toBeTruthy();
    expect(mocks.obtenerMiReputacion).toHaveBeenCalledWith('token', {
      limit: 10,
    });
  });

  it('muestra el estado vacío cuando no hay reseñas', async () => {
    mocks.obtenerMiReputacion.mockResolvedValue({
      ...dataBase,
      promedio: 0,
      totalResenas: 0,
      distribucion: {},
      resenas: [],
    });
    renderReviews();

    await screen.findByText('Este comercio aún no tiene reseñas.');
    expect(screen.getByText(/0 reseñas verificadas/)).toBeTruthy();
  });

  it('carga más reseñas usando el cursor', async () => {
    mocks.obtenerMiReputacion
      .mockResolvedValueOnce({
        ...dataBase,
        totalResenas: 3,
        resenas: [dataBase.resenas[0]],
        paginacion: { limit: 10, nextCursor: 2, hasMore: true },
      })
      .mockResolvedValueOnce({
        ...dataBase,
        totalResenas: 3,
        resenas: [
          {
            id: 3,
            clienteNombre: 'Segundo cliente',
            fecha: '2026-01-03T00:00:00.000Z',
            puntaje: 5,
            comentario: 'Muy recomendable',
          },
        ],
        paginacion: { limit: 10, nextCursor: null, hasMore: false },
      });

    renderReviews();
    await screen.findByText('Ana Pérez');

    fireEvent.click(screen.getByRole('button', { name: 'Ver más' }));

    await waitFor(() =>
      expect(mocks.obtenerMiReputacion).toHaveBeenCalledWith('token', {
        limit: 10,
        cursor: 2,
      }),
    );
    await screen.findByText('Segundo cliente');
    expect(screen.getByText('Ana Pérez')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ver más' })).toBeNull();
  });

  it('muestra el error cuando falla la carga inicial', async () => {
    mocks.obtenerMiReputacion.mockRejectedValue(
      new Error('No se pudo cargar la reputación'),
    );
    renderReviews();

    await screen.findByText('No se pudo cargar la reputación');
  });
});
