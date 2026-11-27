import { Injectable, Logger } from '@nestjs/common';
import { MercadoPagoConfigService } from './mercado-pago.config.js';
import { MercadoPagoOauthError } from './mercado-pago.errors.js';

const URL_TOKEN = 'https://api.mercadopago.com/oauth/token';

export interface TokenMercadoPago {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
  scope: string | null;
  liveMode: boolean | null;
}

interface RespuestaTokenMp {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: number;
  scope?: string;
  live_mode?: boolean;
  error?: string;
  message?: string;
}

@Injectable()
export class MercadoPagoClient {
  private readonly logger = new Logger(MercadoPagoClient.name);

  constructor(private readonly config: MercadoPagoConfigService) {}

  async intercambiarCodigo(
    codigo: string,
    codeVerifier?: string,
  ): Promise<TokenMercadoPago> {
    const cuerpo: Record<string, string> = {
      client_id: this.config.clientId(),
      client_secret: this.config.clientSecret(),
      grant_type: 'authorization_code',
      code: codigo,
      redirect_uri: this.config.redirectUri(),
    };

    if (codeVerifier) {
      cuerpo.code_verifier = codeVerifier;
    }

    if (this.config.testToken()) {
      cuerpo.test_token = 'true';
    }

    const datos = await this.postToken(cuerpo);

    if (
      !datos.access_token ||
      !datos.refresh_token ||
      !datos.user_id ||
      !datos.expires_in
    ) {
      this.logger.error('Mercado Pago devolvió una respuesta incompleta');
      throw new MercadoPagoOauthError(
        'error_interno',
        'Mercado Pago devolvió una respuesta incompleta.',
      );
    }

    return {
      accessToken: datos.access_token,
      refreshToken: datos.refresh_token,
      expiresIn: datos.expires_in,
      userId: String(datos.user_id),
      scope: datos.scope ?? null,
      liveMode: datos.live_mode ?? null,
    };
  }

  private async postToken(
    cuerpo: Record<string, string>,
  ): Promise<RespuestaTokenMp> {
    let respuesta: Response;

    try {
      respuesta = await fetch(URL_TOKEN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams(cuerpo).toString(),
        signal: AbortSignal.timeout(this.config.timeoutMs()),
      });
    } catch {
      throw new MercadoPagoOauthError(
        'mp_no_disponible',
        'No pudimos conectarnos con Mercado Pago. Intentá de nuevo en unos minutos.',
      );
    }

    const texto = await respuesta.text();
    let datos: RespuestaTokenMp = {};

    if (texto) {
      try {
        datos = JSON.parse(texto) as RespuestaTokenMp;
      } catch {
        datos = {};
      }
    }

    if (!respuesta.ok) {
      // No se loguea el cuerpo completo: puede contener datos del comerciante.
      // El `message` de MP describe el motivo del rechazo y no incluye tokens.
      const detalle = datos.message ? `: ${datos.message}` : '';
      this.logger.warn(
        `Mercado Pago rechazó el intercambio (HTTP ${respuesta.status}, error ${datos.error ?? 'desconocido'}${detalle})`,
      );
      throw this.traducirError(respuesta.status, datos.error);
    }

    return datos;
  }

  private traducirError(
    status: number,
    error: string | undefined,
  ): MercadoPagoOauthError {
    if (status === 429) {
      return new MercadoPagoOauthError(
        'mp_no_disponible',
        'Mercado Pago está recibiendo muchas solicitudes. Intentá de nuevo en unos minutos.',
      );
    }

    if (error === 'invalid_grant') {
      return new MercadoPagoOauthError(
        'codigo_invalido',
        'El código de autorización venció o ya fue usado. Volvé a intentar la vinculación.',
      );
    }

    return new MercadoPagoOauthError(
      'error_interno',
      'No pudimos completar la vinculación con Mercado Pago.',
    );
  }
}
