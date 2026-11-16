import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { MercadoPagoConfigService } from './mercado-pago.config.js';

const VERSION = 'v1';
const ALGORITMO = 'aes-256-gcm';
const LARGO_IV = 12;

/**
 * Cifra los tokens de Mercado Pago en reposo con AES-256-GCM.
 * Formato guardado: `v1:<iv b64>:<tag b64>:<ciphertext b64>`.
 */
@Injectable()
export class MercadoPagoCryptoService {
  constructor(private readonly config: MercadoPagoConfigService) {}

  cifrar(texto: string): string {
    const iv = randomBytes(LARGO_IV);
    const cipher = createCipheriv(ALGORITMO, this.config.claveCifrado(), iv);
    const cifrado = Buffer.concat([
      cipher.update(texto, 'utf8'),
      cipher.final(),
    ]);

    return [
      VERSION,
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      cifrado.toString('base64'),
    ].join(':');
  }

  descifrar(sobre: string): string {
    const [version, iv, tag, datos] = sobre.split(':');

    if (version !== VERSION || !iv || !tag || !datos) {
      throw new Error('Formato de credencial cifrada inválido.');
    }

    try {
      const decipher = createDecipheriv(
        ALGORITMO,
        this.config.claveCifrado(),
        Buffer.from(iv, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(tag, 'base64'));

      return Buffer.concat([
        decipher.update(Buffer.from(datos, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new Error(
        'No se pudieron descifrar las credenciales de Mercado Pago.',
      );
    }
  }
}
