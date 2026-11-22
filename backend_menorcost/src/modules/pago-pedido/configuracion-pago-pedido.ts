import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const MINUTOS_EXPIRACION_POR_DEFECTO = 60;
const MINUTOS_GRACIA_POR_DEFECTO = 5;
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
 * real (mismo criterio que CU-1.09). No hay modo simulado.
 *
 * Variables:
 * - `MP_URL_PUBLICA`: URL HTTPS del backend, para el webhook.
 * - `MP_WEBHOOK_SECRET`: clave secreta del panel de webhooks.
 * - `FRONTEND_URL`: base de las URLs de retorno.
 * - `PAGOS_MINUTOS_EXPIRACION`: reserva de stock (60 por defecto).
 * - `PAGOS_MINUTOS_GRACIA`: margen extra antes de que el reaper cancele (5).
 */
@Injectable()
export class ConfiguracionPagoPedido {
  constructor(private readonly config: ConfigService) {}

  /**
   * Ventana de reserva de stock. Por defecto 60 minutos porque Mercado Pago
   * permite hasta 40 minutos para completar un desafío 3DS: con una ventana
   * más corta se podría cancelar un pedido que después se cobra.
   */
  minutosExpiracion(): number {
    return this.enteroPositivo(
      this.config.get<string>('PAGOS_MINUTOS_EXPIRACION'),
      MINUTOS_EXPIRACION_POR_DEFECTO,
    );
  }

  /**
   * Margen que espera el reaper después del vencimiento: cubre el desfasaje
   * entre el reloj local, el de Mercado Pago y el webhook en vuelo.
   */
  minutosGracia(): number {
    return this.enteroPositivo(
      this.config.get<string>('PAGOS_MINUTOS_GRACIA'),
      MINUTOS_GRACIA_POR_DEFECTO,
    );
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

  private enteroPositivo(crudo: string | undefined, porDefecto: number): number {
    const valor = Number(crudo ?? '');

    return Number.isFinite(valor) && valor > 0 ? Math.ceil(valor) : porDefecto;
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
