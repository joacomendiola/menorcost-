import { useEffect, useState } from 'react';
import { simuladorPreciosApi } from '../../api';
import type {
  EstadoSimuladorPrecios,
  SimulacionPrecio,
} from './simulador.types';

const MONTO_REGEX = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;
const ESPERA_DEBOUNCE_MS = 350;

export function useSimuladorPrecios(
  token: string,
  precioLista: string,
  precioBaseNeto: string,
): EstadoSimuladorPrecios {
  const [resultado, setResultado] = useState<SimulacionPrecio | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    const lista = precioLista.trim();
    const base = precioBaseNeto.trim();
    let activo = true;

    setResultado(null);
    setError('');
    setCargando(false);

    if (
      !token ||
      !MONTO_REGEX.test(lista) ||
      !MONTO_REGEX.test(base) ||
      Number(lista) <= 0 ||
      Number(base) <= 0
    ) {
      return;
    }

    setCargando(true);

    const temporizador = window.setTimeout(() => {
      void simuladorPreciosApi
        .calcular(token, {
          precioBaseNeto: base,
          precioLista: lista,
        })
        .then((respuesta) => {
          if (!activo) return;
          setResultado(respuesta);
        })
        .catch((errorSimulacion: unknown) => {
          if (!activo) return;
          setError(
            errorSimulacion instanceof Error
              ? errorSimulacion.message
              : 'No se pudo calcular el precio. Intentá nuevamente.',
          );
        })
        .finally(() => {
          if (activo) setCargando(false);
        });
    }, ESPERA_DEBOUNCE_MS);

    return () => {
      activo = false;
      window.clearTimeout(temporizador);
    };
  }, [precioBaseNeto, precioLista, token]);

  return { resultado, error, cargando };
}
