import { afterEach, describe, expect, it, vi } from 'vitest';
import { reportesApi, type MisReportesResponse } from './api';

const fetchMock = vi.fn();

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe('reportesApi.misReportes', () => {
  it('respeta el contrato { data, pagination } del backend', async () => {
    const payload: MisReportesResponse = {
      data: [
        {
          id_reporte: 7,
          motivo: 'Producto en mal estado',
          descripcion: null,
          estado_reporte: 'RESUELTO',
          tipo_destino: 'COMERCIO',
          fecha_reporte: '2026-01-01T00:00:00.000Z',
          fecha_resolucion: '2026-01-02T00:00:00.000Z',
          id_pedido: 'p1',
          id_emisor: 'u1',
          id_denunciado: 'u2',
          id_admin: 'a1',
          pedido: null,
          denunciado: { id: 'u2', nombre: 'Luis', apellido: 'Gómez' },
        },
      ],
      pagination: { page: 2, limit: 5, total: 11, totalPages: 3 },
    };

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(payload),
    });
    vi.stubGlobal('fetch', fetchMock);

    const resultado = await reportesApi.misReportes('token', {
      page: 2,
      limit: 5,
      estado: 'RESUELTO',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        '/reports/my-reports?page=2&limit=5&estado=RESUELTO',
      ),
      expect.objectContaining({
        method: 'GET',
        headers: { Authorization: 'Bearer token' },
      }),
    );
    expect(resultado).toEqual(payload);
    expect(resultado.data).toHaveLength(1);
    expect(resultado.pagination.totalPages).toBe(3);
    expect(resultado).not.toHaveProperty('reportes');
  });
});

describe('reportesApi.pedidosComerciante', () => {
  it('consulta solo la lista protegida de pedidos reportables del comerciante', async () => {
    const payload = [
      {
        id_pedido: 'p1',
        codigoAlfanumerico: 'MC-123',
        estado: 'ENTREGADO',
        fecha_pedido: '2026-01-01T00:00:00.000Z',
        total: '150.00',
        items: [],
        reporteAbierto: null,
      },
    ];
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(payload),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(reportesApi.pedidosComerciante('token')).resolves.toEqual(
      payload,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/reports/merchant-orders'),
      expect.objectContaining({
        method: 'GET',
        headers: {
          Authorization: expect.stringMatching(/^Bearer .+/),
        },
      }),
    );
  });
});
