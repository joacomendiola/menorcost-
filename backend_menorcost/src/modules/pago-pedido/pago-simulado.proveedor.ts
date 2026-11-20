import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client.js';
import { fechaArgentinaISO } from '../../common/utils/fechas-ar.util.js';
import { aDecimal, aMonto, redondearArriba2 } from '../../common/utils/montos.util.js';
import type {
  InicioPago,
  ModoPago,
  NotificacionPago,
  PuertoPagos,
  ResultadoNotificacion,
  SolicitudInicioPago,
} from './puerto-pagos.js';

/**
 * Implementación simulada: no habla con Mercado Pago ni genera redirección.
 *
 * Mantiene el mismo comportamiento que tenía `pago-simulado.service.ts`
 * (comprobante `SIM-*`, comisión de MP estimada con la tasa congelada del
 * pedido) pero detrás del contrato nuevo, para que el checkout no cambie
 * cuando se active la pasarela real.
 */
@Injectable()
export class PagoSimuladoProveedor implements PuertoPagos {
  modo(): ModoPago {
    return 'simulado';
  }

  async iniciarPago(solicitud: SolicitudInicioPago): Promise<InicioPago> {
    const aprobado = (solicitud.resultadoSimulado ?? 'APROBADO') === 'APROBADO';

    if (!aprobado) {
      return {
        requiereRedireccion: false,
        urlRedireccion: null,
        referenciaExterna: solicitud.referenciaExterna,
        mpOrderId: null,
        resultadoInmediato: {
          aprobado: false,
          estadoPago: 'RECHAZADO',
          nroComprobante: null,
          mpPaymentId: null,
          comisionMp: aMonto(new Prisma.Decimal(0)),
        },
      };
    }

    // Se mantiene la comisión estimada para que el split cierre contra el
    // total. Con Mercado Pago real el valor lo informa la API.
    const comisionMp = redondearArriba2(
      aDecimal(solicitud.total).mul(aDecimal(solicitud.tasaMpEstimada)),
    );

    return {
      requiereRedireccion: false,
      urlRedireccion: null,
      referenciaExterna: solicitud.referenciaExterna,
      mpOrderId: null,
      resultadoInmediato: {
        aprobado: true,
        estadoPago: 'PAGADO',
        nroComprobante: this.generarComprobante(),
        mpPaymentId: null,
        comisionMp: aMonto(comisionMp),
      },
    };
  }

  /** El modo simulado no recibe webhooks: se ignora sin romper el endpoint. */
  async procesarNotificacion(
    _notificacion: NotificacionPago,
  ): Promise<ResultadoNotificacion> {
    return {
      atendida: false,
      detalle: 'El modo simulado no procesa notificaciones de Mercado Pago.',
    };
  }

  private generarComprobante(): string {
    const fecha = fechaArgentinaISO().replaceAll('-', '');
    const sufijo = randomBytes(4).toString('hex').toUpperCase();

    return `SIM-${fecha}-${sufijo}`;
  }
}
