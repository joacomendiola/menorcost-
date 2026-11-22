import { BadRequestException } from '@nestjs/common';
import { fechaISOaDate } from '../../common/utils/fechas-ar.util.js';
import { aDecimal, redondearArriba2 } from '../../common/utils/montos.util.js';
import { Prisma } from '../../generated/prisma/client.js';

/**
 * Cálculo de un pedido a partir de la canasta ya serializada por
 * `CanastasService.obtenerCanastaParaCheckout()`.
 *
 * Vive en `pago-pedido` porque lo usan tanto el resumen del checkout como la
 * reserva de stock: si estuviera en `pedidos`, el servicio de pago tendría que
 * importar un archivo de `pedidos` y el módulo quedaría acoplado.
 *
 * Reglas de CU-1.08 que se respetan acá:
 * - `precioUnitario` es el precio público final (ya incluye el gross-up de MP).
 * - `tarifaServicio` = Σ(ceil2(baseNeto × tasa) × cantidad).
 * - `total` = subtotal, porque el gross-up ya está dentro del precio público.
 */

/** Forma mínima que necesita el cálculo; la cumple el serializador de D3. */
export interface ProductoParaCalculo {
  titulo: string;
  precioBaseNeto: string | Prisma.Decimal;
  comisionMenorcostTasaAplicada: string | Prisma.Decimal;
  tasaMpEstimadaAplicada: string | Prisma.Decimal;
  /** `YYYY-MM-DD` (el serializador del checkout la expone como ISO corto). */
  fechaVencimiento: string;
}

export interface ItemCanastaParaCalculo {
  productoId: string;
  cantidad: number;
  precioUnitario: string | Prisma.Decimal;
  producto: ProductoParaCalculo;
}

export interface DetalleCanastaParaCalculo {
  items: readonly ItemCanastaParaCalculo[];
}

export interface LineaPedidoCalculada {
  productoId: string;
  nroLinea: number;
  cantidad: number;
  precioUnitario: Prisma.Decimal;
  precioBaseNetoAplicado: Prisma.Decimal;
  comisionMenorcostMonto: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  nombreHistorico: string;
  fechaVencimientoHistorica: Date;
  baseNetoTotal: Prisma.Decimal;
}

export interface CalculoPedido {
  lineas: LineaPedidoCalculada[];
  subtotal: Prisma.Decimal;
  tarifaServicio: Prisma.Decimal;
  /** Neto que le corresponde al comercio antes de descontar la comisión de MP. */
  splitComercio: Prisma.Decimal;
  total: Prisma.Decimal;
  tasaMenorcost: Prisma.Decimal;
  tasaMp: Prisma.Decimal;
}

export function calcularPedido(
  detalle: DetalleCanastaParaCalculo,
): CalculoPedido {
  if (detalle.items.length === 0) {
    throw new BadRequestException('La canasta está vacía.');
  }

  const lineas: LineaPedidoCalculada[] = detalle.items.map(
    (item, indice) => {
      const precioUnitario = aDecimal(item.precioUnitario);
      const baseNeto = aDecimal(item.producto.precioBaseNeto);
      const tasaMenorcost = aDecimal(
        item.producto.comisionMenorcostTasaAplicada,
      );
      const comisionUnitaria = redondearArriba2(baseNeto.mul(tasaMenorcost));

      return {
        productoId: item.productoId,
        nroLinea: indice + 1,
        cantidad: item.cantidad,
        precioUnitario,
        precioBaseNetoAplicado: baseNeto,
        comisionMenorcostMonto: comisionUnitaria.mul(item.cantidad),
        subtotal: precioUnitario.mul(item.cantidad),
        nombreHistorico: item.producto.titulo,
        fechaVencimientoHistorica: fechaISOaDate(
          item.producto.fechaVencimiento,
        ),
        baseNetoTotal: baseNeto.mul(item.cantidad),
      };
    },
  );

  const cero = new Prisma.Decimal(0);
  const subtotal = lineas.reduce(
    (acumulado, linea) => acumulado.plus(linea.subtotal),
    cero,
  );
  const tarifaServicio = lineas.reduce(
    (acumulado, linea) => acumulado.plus(linea.comisionMenorcostMonto),
    cero,
  );
  const splitComercio = lineas.reduce(
    (acumulado, linea) => acumulado.plus(linea.baseNetoTotal),
    cero,
  );

  return {
    lineas,
    subtotal,
    tarifaServicio,
    splitComercio,
    total: subtotal,
    tasaMenorcost: aDecimal(
      detalle.items[0].producto.comisionMenorcostTasaAplicada,
    ),
    tasaMp: aDecimal(detalle.items[0].producto.tasaMpEstimadaAplicada),
  };
}
