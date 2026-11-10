import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PanelComerciante } from './PanelComerciante';

vi.mock('../../components/layout/MerchantHeader', () => ({
  MerchantHeader: () => <header data-testid="merchant-header">MENU</header>,
}));

function renderizar(entrada: string) {
  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <Routes>
        <Route path="/panel" element={<PanelComerciante />}>
          <Route index element={<div>RESUMEN</div>} />
          <Route path="resumen" element={<div>RESUMEN</div>} />
          <Route path="pedidos" element={<div>PEDIDOS</div>} />
          <Route path="productos" element={<div>PRODUCTOS</div>} />
          <Route path="mi-local" element={<div>MI LOCAL</div>} />
          <Route path="horarios" element={<div>HORARIOS</div>} />
          <Route path="reputacion" element={<div>REPUTACION</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('PanelComerciante (P11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['/panel', 'RESUMEN'],
    ['/panel/resumen', 'RESUMEN'],
    ['/panel/pedidos', 'PEDIDOS'],
    ['/panel/productos', 'PRODUCTOS'],
    ['/panel/mi-local', 'MI LOCAL'],
    ['/panel/horarios', 'HORARIOS'],
    ['/panel/reputacion', 'REPUTACION'],
  ])('monta la subruta %s con el encabezado del panel', (entrada, texto) => {
    renderizar(entrada);

    expect(screen.getByTestId('merchant-header')).toBeInTheDocument();
    expect(screen.getByText(texto)).toBeInTheDocument();
  });
});
