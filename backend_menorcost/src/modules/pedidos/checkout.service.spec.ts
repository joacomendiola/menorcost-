import {
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutService } from './checkout.service.js';

describe('CheckoutService', () => {
  const usuarioId = '11111111-1111-4111-8111-111111111111';
  const comercioId = '22222222-2222-4222-8222-222222222222';
  const canastaId = '33333333-3333-4333-8333-333333333333';
  const franjaId = '44444444-4444-4444-8444-444444444444';
  const productoId = '55555555-5555-4555-8555-555555555555';

  const prisma = {
    canasta: {
      findUnique: vi.fn(),
    },
    comercio: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const detalle = {
    idCanasta: canastaId,
    comercioId,
    comercio: { nombreFantasia: 'Almacén del Centro' },
    subtotal: '9411.78',
    items: [
      {
        idCanastaItem: '66666666-6666-4666-8666-666666666666',
        productoId,
        cantidad: 2,
        precioUnitario: '4705.89',
        subtotal: '9411.78',
        producto: {
          idProducto: productoId,
          titulo: 'Yogur entero',
          imagen: '/uploads/yogur.jpg',
          stock: 10,
          precioPublico: '4705.89',
          precioBaseNeto: '1000.00',
          comisionMenorcostTasaAplicada: '0.1000',
          tasaMpEstimadaAplicada: '0.0650',
          estado: 'ACTIVO',
          fechaVencimiento: '2026-12-31',
        },
      },
    ],
  };

  const canastas = {
    obtenerCanastaParaCheckout: vi.fn(),
  };

  const franjas = {
    listarParaCheckout: vi.fn(),
    validarParaCheckout: vi.fn(),
  };

  let service: CheckoutService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CheckoutService(
      prisma as never,
      canastas as never,
      franjas as never,
    );

    prisma.canasta.findUnique.mockResolvedValue({ idCanasta: canastaId });
    prisma.comercio.findUnique.mockResolvedValue({
      nombreFantasia: 'Almacén del Centro',
      calle: 'Av. San Martín',
      numero: '123',
      piso: null,
      localidad: 'Ushuaia',
      provincia: 'Tierra del Fuego',
      abierto: true,
    });
    canastas.obtenerCanastaParaCheckout.mockResolvedValue(detalle);
    franjas.listarParaCheckout.mockResolvedValue([]);
  });

  describe('obtenerResumen', () => {
    it('arma el resumen con montos como string y las franjas del comercio', async () => {
      const resultado = await service.obtenerResumen(usuarioId, comercioId);

      expect(resultado.comercio).toEqual({
        idComercio: comercioId,
        nombreFantasia: 'Almacén del Centro',
        direccion: 'Av. San Martín 123, Ushuaia, Tierra del Fuego',
        abierto: true,
      });
      expect(resultado.subtotal).toBe('9411.78');
      expect(resultado.total).toBe('9411.78');
      expect(resultado).not.toHaveProperty('tarifaServicio');
      expect(resultado.items[0]).toEqual(
        expect.objectContaining({
          productoId,
          cantidad: 2,
          precioUnitario: '4705.89',
          subtotal: '9411.78',
        }),
      );
      expect(franjas.listarParaCheckout).toHaveBeenCalledWith(comercioId);
    });

    it('devuelve 404 si el usuario no tiene canasta en ese comercio', async () => {
      prisma.canasta.findUnique.mockResolvedValue(null);

      await expect(
        service.obtenerResumen(usuarioId, comercioId),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(canastas.obtenerCanastaParaCheckout).not.toHaveBeenCalled();
    });

    it('devuelve 404 si el comercio no existe', async () => {
      prisma.comercio.findUnique.mockResolvedValue(null);

      await expect(
        service.obtenerResumen(usuarioId, comercioId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('pagar', () => {
    it('todavía no cobra: responde 503 sin tocar la canasta ni el stock', async () => {
      const promesa = service.pagar(usuarioId, {
        comercioId,
        franjaHorarioId: franjaId,
        idempotencyKey: 'clave-1',
      });

      await expect(promesa).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      await expect(promesa).rejects.toMatchObject({
        status: 503,
        message: expect.stringContaining('Mercado Pago'),
      });

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(canastas.obtenerCanastaParaCheckout).not.toHaveBeenCalled();
    });
  });
});
