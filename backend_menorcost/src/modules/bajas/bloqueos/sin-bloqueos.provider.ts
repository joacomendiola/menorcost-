import { Injectable } from '@nestjs/common';
import type { BajaBloqueosPort, BloqueoBaja } from './baja-bloqueos.port.js';

/**
 * Implementación por defecto: no bloquea y no pausa ofertas.
 *
 * Debe reemplazarse por la implementación que consulte `Pedido` y `Reporte`
 * cuando D4 y D5 definan sus modelos (basta con provee otra clase para
 * `BAJA_BLOQUEOS_PORT` en `BajaModule`).
 */
@Injectable()
export class SinBloqueosProvider implements BajaBloqueosPort {
  obtenerBloqueos(_usuarioId: string): Promise<BloqueoBaja[]> {
    return Promise.resolve([]);
  }

  pausarOfertas(_usuarioId: string): Promise<void> {
    return Promise.resolve();
  }

  reactivarOfertas(_usuarioId: string): Promise<void> {
    return Promise.resolve();
  }
}
