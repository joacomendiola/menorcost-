// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditarOfertaModal } from './EditarOfertaModal';
import type { Offer } from './ofertasApi';

const mocks = vi.hoisted(() => ({
  simulacion: {
    resultado: null as unknown,
    error: '',
    cargando: false,
  },
}));

vi.mock('./simulador/useSimuladorPrecios', () => ({
  useSimuladorPrecios: () => mocks.simulacion,
}));

const offer: Offer = {
  id: 'offer-1',
  comercioId: 'comercio-1',
  categoriaId: 'categoria-1',
  titulo: 'Yogur natural x2',
  descripcion: 'Pack de dos yogures',
  fechaVencimiento: '2099-12-31',
  stock: 5,
  precioLista: '100.00',
  precioBaseNeto: '75.00',
  precioPublico: '88.24',
  comisionMenorcostTasaAplicada: '0.1000',
  tasaMpEstimadaAplicada: '0.0650',
  imagen: '/uploads/yogur.webp',
  estado: 'ACTIVO',
};

function renderModal() {
  const onClose = vi.fn();
  const onSaved = vi.fn();

  render(
    <MantineProvider>
      <EditarOfertaModal
        offer={offer}
        opened
        token="token"
        onClose={onClose}
        onSaved={onSaved}
      />
    </MantineProvider>,
  );

  return { onClose, onSaved };
}

function stubFetch(payload: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  });

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

beforeEach(() => {
  mocks.simulacion = {
    resultado: {
      precioBaseNeto: '75.00',
      comisionMenorcostTasa: '0.1000',
      comisionMenorcostMonto: '7.50',
      tasaMpEstimada: '0.0650',
      comisionMpEstimada: '5.57',
      precioPublico: '88.24',
      netoEstimadoComerciante: '75.17',
      advertenciaNeto: '',
    },
    error: '',
    cargando: false,
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('EditarOfertaModal', () => {
  it('precarga los datos editables de la oferta', () => {
    renderModal();

    expect(screen.getByLabelText('Precio de lista original')).toHaveValue(
      '100.00',
    );
    expect(screen.getByLabelText('Precio base neto a cobrar')).toHaveValue(
      '75.00',
    );
    expect(screen.getByLabelText('Stock')).toHaveValue(5);
    expect(screen.getByLabelText('Fecha de vencimiento')).toHaveValue(
      '2099-12-31',
    );
    expect(screen.getByText('Yogur natural x2')).toBeInTheDocument();
  });

  it('envía solo los campos modificados y avisa al guardar', async () => {
    const fetchMock = stubFetch({ ...offer, stock: 8 });
    const { onSaved } = renderModal();

    fireEvent.change(screen.getByLabelText('Stock'), {
      target: { value: '8' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = init.body as FormData;

    expect(init.method).toBe('PATCH');
    expect(body.get('stock')).toBe('8');
    expect(body.get('precioLista')).toBeNull();
    expect(body.get('precioBaseNeto')).toBeNull();
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it('advierte cuando la comisión vigente cambió y se editan precios', () => {
    mocks.simulacion = {
      ...mocks.simulacion,
      resultado: {
        precioBaseNeto: '75.00',
        comisionMenorcostTasa: '0.1200',
        comisionMenorcostMonto: '9.00',
        tasaMpEstimada: '0.0650',
        comisionMpEstimada: '6.05',
        precioPublico: '90.05',
        netoEstimadoComerciante: '75.00',
        advertenciaNeto: '',
      },
    };
    renderModal();

    fireEvent.change(screen.getByLabelText('Precio de lista original'), {
      target: { value: '110.00' },
    });

    expect(screen.getByText('La comisión vigente cambió')).toBeInTheDocument();
    expect(
      screen.getByText(/se vuelven a aplicar las comisiones vigentes/i),
    ).toBeInTheDocument();
  });

  it('no envía la solicitud si no hubo cambios', async () => {
    const fetchMock = stubFetch({ ...offer });
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(
      screen.getByText('No modificaste ningún dato de la oferta.'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('usa el mínimo informado por el backend cuando el stock está reservado', async () => {
    stubFetch(
      {
        message:
          'El stock no puede ser inferior a las unidades que ya fueron reservadas por los clientes',
        minimumStock: 3,
      },
      400,
    );
    renderModal();

    fireEvent.change(screen.getByLabelText('Stock'), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Stock')).toHaveValue(3),
    );
    expect(
      screen.getByText('Mínimo por unidades reservadas: 3'),
    ).toBeInTheDocument();
  });
});
