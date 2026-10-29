import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { SimuladorPreciosService } from './simulador-precios.service.js';

function crearServicio(config: unknown) {
  const prisma = {
    configComision: {
      findFirst: vi.fn().mockResolvedValue(config),
    },
  } as unknown as PrismaService;

  return new SimuladorPreciosService(prisma);
}

const configActiva = {
  comisionMenorcost: new Prisma.Decimal('0.1000'),
};

describe('SimuladorPreciosService', () => {
  it('obtiene la comisión de la BD y la tasa MP de la constante interna', async () => {
    const servicio = crearServicio(configActiva);

    const resultado = await servicio.calcular({
      precioBaseNeto: '2000.00',
      precioLista: '2400.00',
    });

    expect(resultado.comisionMenorcostTasa).toBe('0.1000');
    expect(resultado.tasaMpEstimada).toBe('0.0650');
    expect(resultado.precioPublico).toBe('2352.95');
    expect(resultado.netoEstimadoComerciante).toBe('2000.00');
  });

  it('falla si no hay una configuración de comisión activa', async () => {
    const servicio = crearServicio(null);

    await expect(
      servicio.calcular({ precioBaseNeto: '100.00' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('devuelve el cálculo aunque el precio público no ofrezca descuento', async () => {
    const servicio = crearServicio(configActiva);

    const resultado = await servicio.calcular({
      precioBaseNeto: '100.00',
      precioLista: '100.00',
    });

    expect(resultado.precioPublico).toBe('117.65');
    expect(resultado.netoEstimadoComerciante).toBe('100.00');
    expect(resultado.ahorroPorcentaje).toBe('-17.65');
  });

  it('traduce los errores de cálculo a BadRequestException', async () => {
    const servicio = crearServicio(configActiva);

    await expect(
      servicio.calcular({ precioBaseNeto: '0' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
