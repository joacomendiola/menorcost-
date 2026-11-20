/**
 * Utilidades de montos compartidas.
 *
 * La implementación vive en `common/utils/montos.util.ts` para que los módulos
 * de pago puedan usarla sin depender del módulo de pedidos. Este archivo se
 * mantiene como punto de entrada histórico.
 */
export {
  aDecimal,
  aMonto,
  redondearArriba2,
} from '../../common/utils/montos.util.js';
