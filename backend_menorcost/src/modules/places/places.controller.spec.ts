import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlacesController } from './places.controller.js';

describe('PlacesController', () => {
  const serviceMock = {
    autocompletar: vi.fn(),
    detalle: vi.fn(),
  };

  const controller = new PlacesController(serviceMock as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delega la búsqueda de sugerencias', async () => {
    const sugerencias = [{ placeId: 'ChIJ123' }];
    serviceMock.autocompletar.mockResolvedValue(sugerencias);

    await expect(
      controller.autocompletar({ texto: 'kiosco' }),
    ).resolves.toEqual(sugerencias);
    expect(serviceMock.autocompletar).toHaveBeenCalledWith('kiosco');
  });

  it('delega el detalle de un lugar', async () => {
    const detalle = { placeId: 'ChIJ123' };
    serviceMock.detalle.mockResolvedValue(detalle);

    await expect(controller.detalle('ChIJ123')).resolves.toEqual(detalle);
    expect(serviceMock.detalle).toHaveBeenCalledWith('ChIJ123');
  });
});
