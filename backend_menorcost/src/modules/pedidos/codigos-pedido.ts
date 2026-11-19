import { randomInt, randomUUID } from 'node:crypto';
import { fechaArgentinaISO } from '../../common/utils/fechas-ar.util.js';

/**
 * Alfabeto sin caracteres ambiguos (sin I, O, 0 ni 1) para que el código
 * alfanumérico se pueda dictar o tipear en el mostrador sin confusiones.
 */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Payload del QR: un UUID único, tal como lo espera el comprobante digital. */
export function generarCodigoQR(): string {
  return randomUUID();
}

export function generarCodigoAlfanumerico(largo = 8): string {
  let codigo = '';

  for (let indice = 0; indice < largo; indice += 1) {
    codigo += ALFABETO[randomInt(ALFABETO.length)];
  }

  return codigo;
}

/** Número interno del pedido: `MC-YYYYMMDD-XXXXXX` (máximo 30 caracteres). */
export function generarNroPedido(ahora: Date = new Date()): string {
  const fecha = fechaArgentinaISO(ahora).replaceAll('-', '');

  return `MC-${fecha}-${generarCodigoAlfanumerico(6)}`;
}
