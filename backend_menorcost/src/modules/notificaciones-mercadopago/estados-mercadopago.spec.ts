import { describe, expect, it } from 'vitest';
import {
  resultadoDeOrden,
  ultimoPagoDeOrden,
} from './estados-mercadopago.js';

describe('resultadoDeOrden', () => {
  it('order processed es pagado', () => {
    expect(resultadoDeOrden({ status: 'processed' })).toBe('pagado');
  });

  it('pago approved es pagado aunque la order no esté processed', () => {
    expect(
      resultadoDeOrden({
        status: 'created',
        transactions: { payments: [{ id: 'PAY-1', status: 'approved' }] },
      }),
    ).toBe('pagado');
  });

  it('pago rejected es rechazado y el pedido puede reintentarse', () => {
    expect(
      resultadoDeOrden({
        status: 'created',
        transactions: { payments: [{ id: 'PAY-1', status: 'rejected' }] },
      }),
    ).toBe('rechazado');
  });

  it('orders rechazadas, canceladas o vencidas cierran el intento', () => {
    expect(resultadoDeOrden({ status: 'rejected' })).toBe('rechazado');
    expect(resultadoDeOrden({ status: 'failed' })).toBe('rechazado');
    expect(resultadoDeOrden({ status: 'cancelled' })).toBe('rechazado');
    expect(resultadoDeOrden({ status: 'expired' })).toBe('rechazado');
  });

  it('created sin pagos sigue pendiente', () => {
    expect(resultadoDeOrden({ status: 'created' })).toBe('pendiente');
  });

  it('action_required sigue pendiente', () => {
    expect(resultadoDeOrden({ status: 'action_required' })).toBe('pendiente');
  });
});

describe('ultimoPagoDeOrden', () => {
  it('devuelve el intento más reciente', () => {
    const orden = {
      transactions: {
        payments: [
          { id: 'PAY-1', status: 'approved', attempt_number: 1 },
          { id: 'PAY-2', status: 'rejected', attempt_number: 2 },
        ],
      },
    };

    expect(ultimoPagoDeOrden(orden)?.id).toBe('PAY-2');
    expect(resultadoDeOrden(orden)).toBe('rechazado');
  });
});
