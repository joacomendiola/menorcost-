import { useEffect, useState } from 'react';
import { simuladorPreciosApi } from '../../api';
import type {
  EstadoSimuladorPrecios,
  SimulacionPrecio,
} from './simulador.types';

const MONTO_REGEX = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;
const ESPERA_DEBOUNCE_MS = 350;

type EstadoSolicitud = {
  clave: string;
  resultado: SimulacionPrecio | null;
  error: string;
  cargando: boolean;
};

const ESTADO_INICIAL: EstadoSolicitud = {
  clave: '',
  resultado: null,
  error: '',
  cargando: false,
};

export function useSimuladorPrecios(
  token: string,
  precioLista: string,
  precioBaseNeto: string,
): EstadoSimuladorPrecios {
  const [estado, setEstado] = useState<EstadoSolicitud>(ESTADO_INICIAL);

  const lista = precioLista.trim();
  const base = precioBaseNeto.trim();
  const clave = `${token}|${lista}|${base}`;
  const montosValidos =
    Boolean(token) &&
    MONTO_REGEX.test(lista) &&
    MONTO_REGEX.test(base) &&
    Number(lista) > 0 &&
    Number(base) > 0;

  useEffect(() => {
    if (!montosValidos) return;

    let activo = true;

    const temporizador = window.setTimeout(() => {
      setEstado({ clave, resultado: null, error: '', cargando: true });

      void simuladorPreciosApi
        .calcular(token, {
          precioBaseNeto: base,
          precioLista: lista,
        })
        .then((respuesta) => {
          if (!activo) return;
          setEstado({
            clave,
            resultado: respuesta,
            error: '',
            cargando: false,
          });
        })
        .catch((errorSimulacion: unknown) => {
          if (!activo) return;
          setEstado({
            clave,
            resultado: null,
            error:
              errorSimulacion instanceof Error
                ? errorSimulacion.message
                : 'No se pudo calcular el precio. Intentá nuevamente.',
            cargando: false,
          });
        });
    }, ESPERA_DEBOUNCE_MS);

    return () => {
      activo = false;
      window.clearTimeout(temporizador);
    };
  }, [base, clave, lista, montosValidos, token]);

  if (!montosValidos) {
    return { resultado: null, error: '', cargando: false };
  }

  if (estado.clave !== clave) {
    return { resultado: null, error: '', cargando: true };
  }

  return {
    resultado: estado.resultado,
    error: estado.error,
    cargando: estado.cargando,
  };
}
