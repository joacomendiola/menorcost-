import { Injectable, Logger } from '@nestjs/common';
import {
  MercadoPagoConfig,
  MercadoPagoError,
  MPAuthenticationError,
  MPConnectionError,
  MPDependencyError,
  MPForbiddenError,
  MPNotFoundError,
  MPRateLimitError,
  MPResourceLockedError,
  MPServerError,
  OAuth,
  Order,
} from 'mercadopago';
import { MercadoPagoConfigService } from '../mercado-pago/mercado-pago.config.js';
import { ErrorPagoMercadoPago } from './error-pago-mercadopago.js';

/** Body de `POST /v1/orders`, tipado por el SDK oficial. */
export type CuerpoOrdenMp = Parameters<Order['create']>[0]['body'];
/** Orden de Mercado Pago (Orders API) tal como la devuelve el SDK. */
export type RespuestaOrdenMp = Awaited<ReturnType<Order['create']>>;

export interface TokenRenovadoMp {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/** El SDK no tipa `test_token`; Mercado Pago lo acepta en `/oauth/token`. */
type CuerpoRefreshMp = Parameters<OAuth['refresh']>[0]['body'] & {
  test_token?: boolean;
};

/**
 * Adaptador del SDK oficial de Mercado Pago (Orders API + OAuth).
 *
 * Es el único archivo que conoce al SDK: el checkout y las credenciales hablan
 * con esta interfaz y reciben errores de dominio (`ErrorPagoMercadoPago`), así
 * un error HTTP de Mercado Pago nunca se filtra como respuesta al cliente.
 *
 * Los imports son nombrados a propósito: el paquete es CommonJS y el backend es
 * ESM estricto, donde el `import default` no devuelve la clase.
 */
@Injectable()
export class ClienteMercadoPago {
  private readonly logger = new Logger(ClienteMercadoPago.name);

  constructor(private readonly config: MercadoPagoConfigService) {}

  /** `POST /v1/orders`: crea la orden de Checkout Pro con el token del vendedor. */
  async crearOrden(
    accessToken: string,
    cuerpo: CuerpoOrdenMp,
    claveIdempotencia: string,
    comercioId: string,
  ): Promise<RespuestaOrdenMp> {
    try {
      return await this.orden(accessToken).create({
        body: cuerpo,
        requestOptions: {
          timeout: this.config.timeoutMs(),
          // La reserva de stock ya se hizo: reintentar acá podría duplicar la
          // orden. La idempotencia la maneja la clave del pedido.
          maxRetries: 0,
          idempotencyKey: claveIdempotencia,
        },
      });
    } catch (error) {
      throw this.traducir(error, `crear orden (comercio ${comercioId})`);
    }
  }

  /** `GET /v1/orders/{id}`: estado real de la orden (el webhook no lo trae). */
  async obtenerOrden(
    accessToken: string,
    mpOrderId: string,
  ): Promise<RespuestaOrdenMp> {
    try {
      return await this.orden(accessToken).get({
        id: mpOrderId,
        requestOptions: {
          timeout: this.config.timeoutMs(),
          maxRetries: 0,
        },
      });
    } catch (error) {
      throw this.traducir(error, 'consultar orden');
    }
  }

  /**
   * `POST /oauth/token` con `grant_type=refresh_token`.
   *
   * El SDK exige un access token para armar el encabezado `Authorization`
   * aunque este endpoint no lo valide: se manda el token vigente (o vencido)
   * del comercio. Mercado Pago rota también el refresh token, así que el
   * llamador tiene que persistir ambos cifrados.
   */
  async refrescarToken(
    accessToken: string,
    refreshToken: string,
  ): Promise<TokenRenovadoMp> {
    const oauth = new OAuth(new MercadoPagoConfig({ accessToken }));
    const cuerpo: CuerpoRefreshMp = {
      client_id: this.config.clientId(),
      client_secret: this.config.clientSecret(),
      refresh_token: refreshToken,
    };

    if (this.config.testToken()) {
      cuerpo.test_token = true;
    }

    let renovado: Awaited<ReturnType<OAuth['refresh']>>;

    try {
      renovado = await oauth.refresh({
        body: cuerpo,
        requestOptions: {
          timeout: this.config.timeoutMs(),
          maxRetries: 0,
        },
      });
    } catch (error) {
      if (this.esTransitorio(error)) {
        throw new ErrorPagoMercadoPago(
          'mp_no_disponible',
          'No pudimos conectarnos con Mercado Pago para renovar la vinculación. Intentá de nuevo en unos minutos.',
        );
      }

      this.logger.warn(
        `Mercado Pago rechazó la renovación del token (${this.describir(error)})`,
      );
      throw new ErrorPagoMercadoPago(
        'credencial_invalida',
        'La vinculación con Mercado Pago venció. El comercio debe volver a vincular su cuenta.',
      );
    }

    if (
      !renovado.access_token ||
      !renovado.refresh_token ||
      !renovado.expires_in
    ) {
      throw new ErrorPagoMercadoPago(
        'respuesta_invalida',
        'Mercado Pago devolvió una respuesta incompleta al renovar la vinculación.',
      );
    }

    return {
      access_token: renovado.access_token,
      refresh_token: renovado.refresh_token,
      expires_in: renovado.expires_in,
    };
  }

  private orden(accessToken: string): Order {
    return new Order(new MercadoPagoConfig({ accessToken }));
  }

  /** Errores de red, límite de pedidos o fallas de MP: se puede reintentar. */
  private esTransitorio(error: unknown): boolean {
    return (
      error instanceof MPConnectionError ||
      error instanceof MPRateLimitError ||
      error instanceof MPServerError ||
      error instanceof MPResourceLockedError ||
      error instanceof MPDependencyError
    );
  }

  private traducir(error: unknown, detalle: string): ErrorPagoMercadoPago {
    if (this.esTransitorio(error)) {
      return new ErrorPagoMercadoPago(
        'mp_no_disponible',
        'No pudimos conectarnos con Mercado Pago. Intentá de nuevo en unos minutos.',
        detalle,
      );
    }

    if (error instanceof MercadoPagoError) {
      this.logger.warn(
        `Mercado Pago rechazó ${detalle} (${this.describir(error)})`,
      );

      if (
        error instanceof MPAuthenticationError ||
        error instanceof MPForbiddenError
      ) {
        return new ErrorPagoMercadoPago(
          'credencial_invalida',
          'La vinculación con Mercado Pago no es válida. El comercio debe volver a vincular su cuenta.',
          detalle,
        );
      }

      if (error instanceof MPNotFoundError) {
        return new ErrorPagoMercadoPago(
          'orden_no_encontrada',
          'La orden de Mercado Pago no existe.',
          detalle,
        );
      }

      return new ErrorPagoMercadoPago(
        'respuesta_invalida',
        'Mercado Pago rechazó la operación. Revisá la configuración de la aplicación.',
        detalle,
      );
    }

    // Error inesperado (no viene del SDK): no se disfraza de error de negocio.
    throw error;
  }

  /** Status y mensaje de la API; nunca tokens ni datos del comprador. */
  private describir(error: unknown): string {
    if (error instanceof MercadoPagoError) {
      const mensaje = (error.message || error.error || '').slice(0, 300);
      return `HTTP ${error.status}${mensaje ? `: ${mensaje}` : ''}`;
    }

    return error instanceof Error ? error.name : 'error desconocido';
  }
}
