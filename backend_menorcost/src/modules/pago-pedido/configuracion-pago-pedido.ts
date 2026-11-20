import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ModoPago } from './puerto-pagos.js';

const MINUTOS_EXPIRACION_POR_DEFECTO = 60;
const RUTA_RESULTADO_PAGO = '/checkout/resultado';

export interface UrlsRetornoPago {
  exito: string;
  fallo: string;
  pendiente: string;
}

/**
 * Configuración del módulo de pagos.
 *
 * Se lee de forma perezosa a propósito: la aplicación arranca aunque falten
 * las variables de Mercado Pago y el error aparece recién al usar el flujo
 * real (mismo criterio que CU-1.09).
 *
 * Variables:
 * - `PAGOS_MERCADOPAGO_MODO`: `simulado` (por defecto) o `mercadopago`.
 * - `MP_URL_PUBLICA`: URL HTTPS del backend, para el webhook.
 * - `MP_WEBHOOK_SECRET`: clave secreta del panel de webhooks.
 * - `FRONTEND_URL`: base de las URLs de retorno.
 * - `PAGOS_MINUTOS_EXPIRACION`: reserva de stock (60 por defecto).
 */
@Injectable()
export class ConfiguracionPagoPedido {
  constructor(private readonly config: ConfigService) {}

  modo(): ModoPago {
    const crudo = (this.config.get<string>('PAGOS_MERCADOPAGO_MODO') ?? '')
      .trim()
      .toLowerCase();

    if (crudo === 'mercadopago' || crudo === 'real') return 'mercadopago';

    return 'simulado';
  }

  /**
   * Ventana de reserva de stock. Por defecto 60 minutos porque Mercado Pago
   * permite hasta 40 minutos para completar un desafío 3DS: con una ventana
   * más corta se podría cancelar un pedido que después se cobra.
   */
  minutosExpiracion(): number {
    const crudo = Number(
      this.config.get<string>('PAGOS_MINUTOS_EXPIRACION') ?? '',
    );

    return Number.isFinite(crudo) && crudo > 0
      ? Math.ceil(crudo)
      : MINUTOS_EXPIRACION_POR_DEFECTO;
  }

  frontendUrl(): string {
    return (
      this.config.get<string>('FRONTEND_URL')?.trim() || 'http://localhost:5173'
    ).replace(/\/+$/, '');
  }

  /** URLs a las que Mercado Pago devuelve al comprador. */
  urlsRetorno(): UrlsRetornoPago {
    const base = `${this.frontendUrl()}${RUTA_RESULTADO_PAGO}`;

    return {
      exito: `${base}?estado=aprobado`,
      fallo: `${base}?estado=rechazado`,
      pendiente: `${base}?estado=pendiente`,
    };
  }

  /** URL pública del backend que recibe las notificaciones de Mercado Pago. */
  urlWebhook(): string {
    return `${this.requerida('MP_URL_PUBLICA').replace(/\/+$/, '')}/notificaciones-mercadopago`;
  }

  secretoWebhook(): string {
    return this.requerida('MP_WEBHOOK_SECRET');
  }

  private requerida(clave: string): string {
    const valor = this.config.get<string>(clave)?.trim();

    if (!valor) {
      throw new Error(
        `Falta la variable de entorno ${clave}. Configurala en backend_menorcost/.env para usar el pago real con Mercado Pago.`,
      );
    }

    return valor;
  }
}
