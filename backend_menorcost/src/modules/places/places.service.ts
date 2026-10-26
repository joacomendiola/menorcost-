import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const URL_AUTOCOMPLETAR =
  'https://places.googleapis.com/v1/places:autocomplete';
const URL_DETALLE = 'https://places.googleapis.com/v1/places/';
const CAMPOS_DETALLE =
  'id,displayName,formattedAddress,location,addressComponents';

interface ComponenteDireccion {
  longText?: string;
  shortText?: string;
  types?: string[];
}

interface SugerenciaGoogle {
  placePrediction?: {
    placeId?: string;
    text?: { text?: string };
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
  };
}

interface RespuestaAutocompletar {
  suggestions?: SugerenciaGoogle[];
}

interface DetalleGoogle {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: ComponenteDireccion[];
}

function componente(componentes: ComponenteDireccion[], tipo: string): string {
  return componentes.find((item) => item.types?.includes(tipo))?.longText ?? '';
}

@Injectable()
export class PlacesService {
  constructor(private readonly config: ConfigService) {}

  async autocompletar(texto: string) {
    const apiKey = this.obtenerApiKey();

    const respuesta = await fetch(URL_AUTOCOMPLETAR, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify({
        input: texto,
        languageCode: 'es',
        includedRegionCodes: ['ar'],
      }),
    });

    if (!respuesta.ok) {
      throw new BadGatewayException(
        'No pudimos consultar Google Places. Intentá de nuevo.',
      );
    }

    const datos = (await respuesta.json()) as RespuestaAutocompletar;

    return (datos.suggestions ?? []).flatMap((sugerencia) => {
      const prediccion = sugerencia.placePrediction;
      const placeId = prediccion?.placeId;

      if (!placeId) {
        return [];
      }

      const textoPrincipal =
        prediccion.structuredFormat?.mainText?.text ??
        prediccion.text?.text ??
        '';
      const textoSecundario =
        prediccion.structuredFormat?.secondaryText?.text ?? '';

      return [
        {
          placeId,
          textoPrincipal,
          textoSecundario,
          descripcion:
            prediccion.text?.text ??
            [textoPrincipal, textoSecundario].filter(Boolean).join(', '),
        },
      ];
    });
  }

  async detalle(placeId: string) {
    if (!placeId.trim()) {
      throw new BadRequestException('Falta el identificador del lugar');
    }

    const apiKey = this.obtenerApiKey();
    const url = new URL(`${URL_DETALLE}${encodeURIComponent(placeId)}`);
    url.searchParams.set('languageCode', 'es');
    url.searchParams.set('regionCode', 'AR');

    const respuesta = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': CAMPOS_DETALLE,
      },
    });

    if (respuesta.status === 404) {
      throw new NotFoundException('No encontramos el lugar seleccionado');
    }

    if (!respuesta.ok) {
      throw new BadGatewayException(
        'No pudimos consultar Google Places. Intentá de nuevo.',
      );
    }

    const datos = (await respuesta.json()) as DetalleGoogle;
    const latitud = datos.location?.latitude;
    const longitud = datos.location?.longitude;

    if (
      datos.id === undefined ||
      latitud === undefined ||
      longitud === undefined
    ) {
      throw new BadGatewayException(
        'Google Places devolvió un lugar incompleto. Elegí otro resultado.',
      );
    }

    const componentes = datos.addressComponents ?? [];

    return {
      placeId: datos.id,
      nombre: datos.displayName?.text ?? '',
      direccion: datos.formattedAddress ?? '',
      calle: componente(componentes, 'route'),
      numero: componente(componentes, 'street_number'),
      localidad:
        componente(componentes, 'locality') ||
        componente(componentes, 'administrative_area_level_2'),
      provincia: componente(componentes, 'administrative_area_level_1'),
      codigoPostal: componente(componentes, 'postal_code'),
      latitud,
      longitud,
    };
  }

  private obtenerApiKey(): string {
    const apiKey = this.config.get<string>('GOOGLE_PLACES_API_KEY')?.trim();

    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Google Places no está configurado',
      );
    }

    return apiKey;
  }
}
