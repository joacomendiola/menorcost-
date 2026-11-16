import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { MercadoPagoConfigService } from './mercado-pago.config.js';
import { MercadoPagoCryptoService } from './mercado-pago-crypto.service.js';

const CLAVE_HEX = 'a'.repeat(64);
const TOKEN = 'APP_USR-4934588586838432-123456-abcdef';

function crearModulo(clave: string) {
  const valores: Record<string, string> = {
    MP_TOKENS_ENCRYPTION_KEY: clave,
  };

  return Test.createTestingModule({
    providers: [
      MercadoPagoConfigService,
      MercadoPagoCryptoService,
      {
        provide: ConfigService,
        useValue: {
          get: (nombre: string) => valores[nombre],
        },
      },
    ],
  }).compile();
}

describe('MercadoPagoCryptoService', () => {
  let servicio: MercadoPagoCryptoService;

  beforeEach(async () => {
    const modulo = await crearModulo(CLAVE_HEX);
    servicio = modulo.get(MercadoPagoCryptoService);
  });

  it('cifra y descifra un token sin perder información', () => {
    const sobre = servicio.cifrar(TOKEN);

    expect(sobre).not.toContain(TOKEN);
    expect(sobre.startsWith('v1:')).toBe(true);
    expect(servicio.descifrar(sobre)).toBe(TOKEN);
  });

  it('genera un sobre distinto en cada cifrado', () => {
    expect(servicio.cifrar(TOKEN)).not.toBe(servicio.cifrar(TOKEN));
  });

  it('rechaza un sobre con formato inválido', () => {
    expect(() => servicio.descifrar('texto-plano')).toThrow(
      'Formato de credencial cifrada inválido.',
    );
  });

  it('falla al descifrar con otra clave', async () => {
    const sobre = servicio.cifrar(TOKEN);
    const otro = await crearModulo('b'.repeat(64));
    const servicioAjeno = otro.get(MercadoPagoCryptoService);

    expect(() => servicioAjeno.descifrar(sobre)).toThrow(
      'No se pudieron descifrar las credenciales de Mercado Pago.',
    );
  });

  it('acepta la clave en base64 de 32 bytes', async () => {
    const base64 = Buffer.alloc(32, 7).toString('base64');
    const modulo = await crearModulo(base64);
    const servicioBase64 = modulo.get(MercadoPagoCryptoService);

    expect(servicioBase64.descifrar(servicioBase64.cifrar(TOKEN))).toBe(TOKEN);
  });
});
