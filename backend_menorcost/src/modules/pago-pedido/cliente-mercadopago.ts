import { Injectable, Logger } from '@nestjs/common';
import { MercadoPagoConfigService } from '../mercado-pago/mercado-pago.config.js';
import { ErrorPagoMercadoPago } from './error-pago-mercadopago.js';

const URL_API = 'https://api.mercadopago.com';
const URL_TOKEN = `${URL_API}/oauth/token`;

/** Respuesta cruda de `POST /v1/orders` y `GET /v1/orders/{id}`. */
export interface RespuestaOrdenMp {
  id?: string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  total_amount?: string;
  total_paid_amount?: string;
  checkout_url?: string;
  transactions?: { payments?: Array<{ id?: string | number; status?: string }> };
  payments?: Array<{ id?: string | number; status?: string }>;
}

export interface RespuestaRefreshTokenMp {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  live_mode?: boolean;
  error?: string;
  message?: string;
}

/**
 * Cliente HTTP de Mercado Pago (Orders API + OAuth).
 *
 * Se usa `fetch` en vez del SDK oficial porque el backend es ESM estricto y el
 * flujo OAuth ya funciona así: una sola forma de hablar con Mercado Pago, con
 * timeout explícito y errores traducidos.
 */
@Injectable()
export class ClienteMercadoPago {
  private readonly logger = new Logger(ClienteMercadoPago.name);

  constructor(private readonly config: MercadoPagoConfigService) {}

  /** `POST /v1/orders`: crea la orden de Checkout Pro con el token del vendedor. */
  async crearOrden(
    accessToken: string,
    cuerpo: Record<string, unknown>,
    claveIdempotencia: string,
    comercioId: string,
  ): Promise<RespuestaOrdenMp> {
    return this.enviar('/v1/orders', accessToken, {
      method: 'POST',
      headers: { 'X-Idempotency-Key': claveIdempotencia },
      body: JSON.stringify(cuerpo),
      detalle: `crear orden (comercio ${comercioId})`,
    });
  }

  /** `GET /v1/orders/{id}`: estado real de la orden (el webhook no lo trae). */
  async obtenerOrden(
    accessToken: string,
    mpOrderId: string,
  ): Promise<RespuestaOrdenMp> {
    return this.enviar(
      `/v1/orders/${encodeURIComponent(mpOrderId)}`,
      accessToken,
      { method: 'GET', detalle: 'consultar orden' },
    );
  }

  /**
   * `POST /oauth/token` con `grant_type=refresh_token`.
   * Mercado Pago rota también el refresh token: el llamador debe persistir
   * ambos tokens cifrados.
   */
  async refrescarToken(
    refreshToken: string,
  ): Promise<Required<Pick<RespuestaRefreshTokenMp, 'access_token' | 'refresh_token' | 'expires_in'>>> {
    let respuesta: Response;

    try {
      respuesta = await fetch(URL_TOKEN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: this.config.clientId(),
          client_secret: this.config.clientSecret(),
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs()),
      });
    } catch {
      throw new ErrorPagoMercadoPago(
        'mp_no_disponible',
        'No pudimos conectarnos con Mercado Pago para renovar la vinculación. Intentá de nuevo en unos minutos.',
      );
    }

    const datos = await this.leerJson(respuesta);

    if (
      !respuesta.ok ||
      !datos.access_token ||
      !datos.refresh_token ||
      !datos.expires_in
    ) {
      this.logger.warn(
        `Mercado Pago rechazó la renovación del token (HTTP ${respuesta.status}, error ${datos.error ?? 'desconocido'})`,
      );
      throw new ErrorPagoMercadoPago(
        'credencial_invalida',
        'La vinculación con Mercado Pago venció. El comercio debe volver a vincular su cuenta.',
      );
    }

    return {
      access_token: datos.access_token,
      refresh_token: datos.refresh_token,
      expires_in: datos.expires_in,
    };
  }

  private async enviar(
    ruta: string,
    accessToken: string,
    opciones: {
      method: 'GET' | 'POST';
      headers?: Record<string, string>;
      body?: string;
      detalle: string;
    },
  ): Promise<RespuestaOrdenMp> {
    let respuesta: Response;

    try {
      respuesta = await fetch(`${URL_API}${ruta}`, {
        method: opciones.method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          ...opciones.headers,
        },
        body: opciones.body,
        signal: AbortSignal.timeout(this.config.timeoutMs()),
      });
    } catch {
      throw new ErrorPagoMercadoPago(
        'mp_no_disponible',
        'No pudimos conectarnos con Mercado Pago. Intentá de nuevo en unos minutos.',
        opciones.detalle,
      );
    }

    const datos = await this.leerJson(respuesta);

    if (!respuesta.ok) {
      const mensaje = this.mensajeDeError(datos);
      this.logger.warn(
        `Mercado Pago rechazó ${opciones.detalle} (HTTP ${respuesta.status}${mensaje ? `: ${mensaje}` : ''})`,
      );

      if (respuesta.status === 401 || respuesta.status === 403) {
        throw new ErrorPagoMercadoPago(
          'credencial_invalida',
          'La vinculación con Mercado Pago no es válida. El comercio debe volver a vincular su cuenta.',
          mensaje,
        );
      }

      if (respuesta.status === 404) {
        throw new ErrorPagoMercadoPago(
          'orden_no_encontrada',
          'La orden de Mercado Pago no existe.',
          mensaje,
        );
      }

      if (respuesta.status === 429 || respuesta.status >= 500) {
        throw new ErrorPagoMercadoPago(
          'mp_no_disponible',
          'Mercado Pago está con problemas momentáneos. Intentá de nuevo en unos minutos.',
          mensaje,
        );
      }

      throw new ErrorPagoMercadoPago(
        'respuesta_invalida',
        'Mercado Pago rechazó la operación. Revisá la configuración de la aplicación.',
        mensaje,
      );
    }

    return datos as RespuestaOrdenMp;
  }

  private async leerJson(
    respuesta: Response,
  ): Promise<Record<string, unknown> & RespuestaRefreshTokenMp> {
    const texto = await respuesta.text();

    if (!texto) return {};

    try {
      return JSON.parse(texto) as Record<string, unknown> &
        RespuestaRefreshTokenMp;
    } catch {
      return {};
    }
  }

  /** Los errores de Mercado Pago traen `message` o `error`; nunca tokens. */
  private mensajeDeError(datos: Record<string, unknown>): string {
    const mensaje = datos.message ?? datos.error;

    return typeof mensaje === 'string' ? mensaje.slice(0, 300) : '';
  }
}
