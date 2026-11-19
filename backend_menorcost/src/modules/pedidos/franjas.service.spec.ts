import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FranjasService } from './franjas.service.js';

describe('FranjasService', () => {
  const comercioId = '11111111-1111-4111-8111-111111111111';
  const franjaId = '22222222-2222-4222-8222-222222222222';

  // Martes 17/11/2026 15:00 en Argentina (UTC-3).
  const martesTarde = new Date('2026-11-17T18:00:00.000Z');

  const franjaManana = {
    id: franjaId,
    diaSemana: 2,
    horaInicio: '10:00',
    horaFin: '11:00',
  };

  const prisma = {
    franjaRetiro: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    horarioAtencion: {
      findMany: vi.fn(),
    },
  };

  let service: FranjasService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FranjasService(prisma as never);
  });

  describe('listarParaCheckout', () => {
    it('devuelve solo las franjas activas del comercio con su etiqueta', async () => {
      prisma.franjaRetiro.findMany.mockResolvedValue([franjaManana]);

      const resultado = await service.listarParaCheckout(
        comercioId,
        martesTarde,
      );

      expect(prisma.franjaRetiro.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { comercioId, activa: true },
        }),
      );
      expect(resultado).toEqual([
        expect.objectContaining({
          id: franjaId,
          diaSemana: 2,
          horaInicio: '10:00',
          horaFin: '11:00',
          // La franja del martes ya pasó: se ofrece la del martes siguiente.
          fechaRetiro: '2026-11-24',
          etiqueta: 'Mar 24/11 · 10:00 a 11:00',
        }),
      ]);
    });
  });

  describe('validarParaCheckout', () => {
    it('rechaza una franja que no existe o no pertenece al comercio', async () => {
      prisma.franjaRetiro.findFirst.mockResolvedValue(null);

      await expect(
        service.validarParaCheckout(comercioId, franjaId, martesTarde),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza una franja que quedó fuera del horario de atención', async () => {
      prisma.franjaRetiro.findFirst.mockResolvedValue(franjaManana);
      prisma.horarioAtencion.findMany.mockResolvedValue([
        { diaSemana: 2, horaInicio: '12:00', horaFin: '18:00' },
      ]);

      await expect(
        service.validarParaCheckout(comercioId, franjaId, martesTarde),
      ).rejects.toThrow(/fuera del horario de atención/);
    });

    it('acepta una franja activa y contenida en el horario de atención', async () => {
      prisma.franjaRetiro.findFirst.mockResolvedValue(franjaManana);
      prisma.horarioAtencion.findMany.mockResolvedValue([
        { diaSemana: 2, horaInicio: '09:00', horaFin: '18:00' },
      ]);

      const resultado = await service.validarParaCheckout(
        comercioId,
        franjaId,
        martesTarde,
      );

      expect(prisma.franjaRetiro.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: franjaId, comercioId, activa: true },
        }),
      );
      expect(resultado.fechaRetiro).toBe('2026-11-24');
    });

    it('ofrece la franja de hoy si todavía no empezó', async () => {
      prisma.franjaRetiro.findFirst.mockResolvedValue({
        ...franjaManana,
        horaInicio: '18:00',
        horaFin: '19:00',
      });
      prisma.horarioAtencion.findMany.mockResolvedValue([
        { diaSemana: 2, horaInicio: '09:00', horaFin: '22:00' },
      ]);

      const resultado = await service.validarParaCheckout(
        comercioId,
        franjaId,
        martesTarde,
      );

      expect(resultado.fechaRetiro).toBe('2026-11-17');
    });
  });
});
