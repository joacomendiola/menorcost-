import { BadRequestException } from '@nestjs/common';
import type { CreateOfferDto } from './dto/create-offer.dto.js';

export function validateOfferRules(
  offer: Pick<
    CreateOfferDto,
    'fechaVencimiento' | 'precioLista' | 'precioMenorcost'
  >,
  now = new Date(),
): void {
  if (!isValidDateOnly(offer.fechaVencimiento)) {
    throw new BadRequestException('La fecha de caducidad no es válida');
  }

  if (offer.fechaVencimiento <= todayInArgentina(now)) {
    throw new BadRequestException(
      'La fecha de caducidad debe ser posterior a la fecha actual',
    );
  }

  const listPrice = toCents(offer.precioLista);
  const promotionalPrice = toCents(offer.precioMenorcost);

  if (listPrice <= 0n || promotionalPrice <= 0n) {
    throw new BadRequestException('Los precios deben ser mayores que cero');
  }

  if (promotionalPrice >= listPrice) {
    throw new BadRequestException(
      'El precio promocional debe ofrecer un descuento real respecto al precio de lista original',
    );
  }
}

function isValidDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function todayInArgentina(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Ushuaia',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const part = (type: string) => parts.find((item) => item.type === type)?.value;

  const year = part('year');
  const month = part('month');
  const day = part('day');

  if (!year || !month || !day) {
    throw new Error('No se pudo determinar la fecha actual en Argentina');
  }

  return `${year}-${month}-${day}`;
}

function toCents(value: string): bigint {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    throw new BadRequestException('El formato de precio no es válido');
  }

  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}