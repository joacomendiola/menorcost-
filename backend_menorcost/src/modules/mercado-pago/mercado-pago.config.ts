import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const CLAVE_HEX = /^[0-9a-fA-F]{64}$/;
const TIMEOUT_POR_DEFECTO_MS = 10_000;

/**
 * Lee la configuración de Mercado Pago de forma perezosa: la aplicación arranca
 * aunque falten variables y el error se muestra recién al usar el flujo OAuth.
 */
@Injectable()
export class MercadoPagoConfigService {
  constructor(private readonly config: ConfigService) {}

  clientId(): string {
    return this.requerida('MP_CLIENT_ID');
  }

  clientSecret(): string {
    return this.requerida('MP_CLIENT_SECRET');
  }

  redirectUri(): string {
    return this.requerida('MP_REDIRECT_URI');
  }

  stateSecret(): string {
    return this.requerida('MP_OAUTH_STATE_SECRET');
  }

  frontendUrl(): string {
    return (
      this.config.get<string>('FRONTEND_URL')?.trim() || 'http://localhost:5173'
    ).replace(/\/+$/, '');
  }

  timeoutMs(): number {
    const crudo = Number(this.config.get<string>('MP_TIMEOUT_MS'));
    return Number.isFinite(crudo) && crudo > 0
      ? crudo
      : TIMEOUT_POR_DEFECTO_MS;
  }

  pkceHabilitado(): boolean {
    return this.config.get<string>('MP_PKCE_ENABLED') === 'true';
  }

  /**
   * Pide a MP un token sandbox en `/oauth/token`. Necesario cuando el Client ID
   * y el Client Secret se toman del entorno de producción (OAuth los exige)
   * pero los cobros se prueban con cuentas y saldo de prueba.
   */
  testToken(): boolean {
    return this.config.get<string>('MP_TEST_TOKEN') === 'true';
  }

  /** Clave de 32 bytes para AES-256-GCM, en hex (64) o base64. */
  claveCifrado(): Buffer {
    const valor = this.requerida('MP_TOKENS_ENCRYPTION_KEY');

    if (CLAVE_HEX.test(valor)) {
      return Buffer.from(valor, 'hex');
    }

    const base64 = Buffer.from(valor, 'base64');
    if (base64.length === 32) {
      return base64;
    }

    throw new Error(
      'MP_TOKENS_ENCRYPTION_KEY debe tener 32 bytes (64 caracteres hexadecimales o base64 de 32 bytes).',
    );
  }

  private requerida(clave: string): string {
    const valor = this.config.get<string>(clave)?.trim();

    if (!valor) {
      throw new Error(
        `Falta la variable de entorno ${clave}. Configurala en backend_menorcost/.env para usar Mercado Pago.`,
      );
    }

    return valor;
  }
}
