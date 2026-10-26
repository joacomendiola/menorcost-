import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlacesService } from './places.service.js';

function respuesta(datos: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(datos),
  } as unknown as Response;
}

const configMock = { get: vi.fn() };
const fetchMock = vi.fn();
const service = new PlacesService(configMock as never);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  configMock.get.mockReturnValue('clave-de-prueba');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PlacesService.autocompletar', () => {
  it('falla si no hay API key configurada', async () => {
    configMock.get.mockReturnValue(undefined);

    await expect(service.autocompletar('kiosco')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normaliza las sugerencias de Google Places', async () => {
    fetchMock.mockResolvedValue(
      respuesta({
        suggestions: [
          {
            placePrediction: {
              placeId: 'ChIJ123',
              text: { text: 'Kiosco Don José, Ushuaia' },
              structuredFormat: {
                mainText: { text: 'Kiosco Don José' },
                secondaryText: { text: 'Ushuaia, Tierra del Fuego' },
              },
            },
          },
          {
            placePrediction: {
              text: { text: 'Resultado sin id' },
            },
          },
        ],
      }),
    );

    await expect(service.autocompletar('kiosco')).resolves.toEqual([
      {
        placeId: 'ChIJ123',
        textoPrincipal: 'Kiosco Don José',
        textoSecundario: 'Ushuaia, Tierra del Fuego',
        descripcion: 'Kiosco Don José, Ushuaia',
      },
    ]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://places.googleapis.com/v1/places:autocomplete');
    expect(init).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({
        'X-Goog-Api-Key': 'clave-de-prueba',
      }),
    });

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      input: 'kiosco',
      languageCode: 'es',
      includedRegionCodes: ['ar'],
    });
  });

  it('traduce un error de Google a bad gateway', async () => {
    fetchMock.mockResolvedValue(respuesta({}, false, 500));

    await expect(service.autocompletar('kiosco')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});

describe('PlacesService.detalle', () => {
  it('rechaza un placeId vacío', async () => {
    await expect(service.detalle('   ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normaliza el detalle del lugar', async () => {
    fetchMock.mockResolvedValue(
      respuesta({
        id: 'ChIJ123',
        displayName: { text: 'Kiosco Don José' },
        formattedAddress: 'San Martín 123, Ushuaia',
        location: { latitude: -54.8019, longitude: -68.303 },
        addressComponents: [
          { longText: 'San Martín', types: ['route'] },
          { longText: '123', types: ['street_number'] },
          { longText: 'Ushuaia', types: ['locality'] },
          {
            longText: 'Tierra del Fuego',
            types: ['administrative_area_level_1'],
          },
          { longText: '9410', types: ['postal_code'] },
        ],
      }),
    );

    await expect(service.detalle('ChIJ123')).resolves.toEqual({
      placeId: 'ChIJ123',
      nombre: 'Kiosco Don José',
      direccion: 'San Martín 123, Ushuaia',
      calle: 'San Martín',
      numero: '123',
      localidad: 'Ushuaia',
      provincia: 'Tierra del Fuego',
      codigoPostal: '9410',
      latitud: -54.8019,
      longitud: -68.303,
    });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toContain(
      'https://places.googleapis.com/v1/places/ChIJ123',
    );
    expect(init.headers).toMatchObject({
      'X-Goog-Api-Key': 'clave-de-prueba',
      'X-Goog-FieldMask':
        'id,displayName,formattedAddress,location,addressComponents',
    });
  });

  it('devuelve not found si Google no encuentra el lugar', async () => {
    fetchMock.mockResolvedValue(respuesta({}, false, 404));

    await expect(service.detalle('ChIJ123')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rechaza un detalle sin coordenadas', async () => {
    fetchMock.mockResolvedValue(
      respuesta({
        id: 'ChIJ123',
        displayName: { text: 'Kiosco Don José' },
      }),
    );

    await expect(service.detalle('ChIJ123')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
