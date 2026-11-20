import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client.js';
import { fechaArgentinaISO } from '../../common/utils/fechas-ar.util.js';
import type { ResultadoPagoSimulado } from './dto/resultado-pago-simulado.js';
import { redondearArriba2 } from './montos.js';

/** Token de inyección: permite cambiar la pasarela sin tocar el checkout. */
export const PASARELA_PAGO = Symbol('PASARELA_PAGO');

export interface SolicitudCobro {
  total: Prisma.Decimal;
  tasaMp: Prisma.Decimal;
  resultado: ResultadoPagoSimulado;
}

export interface ResultadoCobro {
  aprobado: boolean;
  nroComprobante: string | null;
  mpPaymentId: string | null;
  comisionMp: Prisma.Decimal;
}

export interface PasarelaPago {
  cobrar(solicitud: SolicitudCobro): Promise<ResultadoCobro>;
}

/**
 * Pasarela simulada (implementación heredada).
 *
 * @deprecated Queda solo porque `checkout.service.ts` todavía la inyecta.
 * La implementación vigente vive en `modulos/pago-pedido/` detrás del puerto
 * `PUERTO_PAGOS`; este archivo se elimina en la etapa B3, cuando el checkout
 * pase a crear el pedido pendiente y confirmar por el puerto nuevo.
 */
@Injectable()
export class PagoSimuladoService implements PasarelaPago {
  async cobrar(solicitud: SolicitudCobro): Promise<ResultadoCobro> {
    if (solicitud.resultado === 'RECHAZADO') {
      return {
        aprobado: false,
        nroComprobante: null,
        mpPaymentId: null,
        comisionMp: new Prisma.Decimal(0),
      };
    }

    // Se mantiene la comisión estimada del simulador para que el split cierre
    // exactamente contra el total cobrado. Con la pasarela real, el valor lo
    // informa Mercado Pago.
    const comisionMp = redondearArriba2(
      solicitud.total.mul(solicitud.tasaMp),
    );

    return {
      aprobado: true,
      nroComprobante: this.generarComprobante(),
      mpPaymentId: null,
      comisionMp,
    };
  }

  private generarComprobante(): string {
    const fecha = fechaArgentinaISO().replaceAll('-', '');
    const sufijo = randomBytes(4).toString('hex').toUpperCase();

    return `SIM-${fecha}-${sufijo}`;
  }
}
