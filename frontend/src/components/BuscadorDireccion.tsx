import { Loader, TextInput } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { ApiError } from '../api';
import {
  placesApi,
  type PlacesDetalle,
  type PlacesSugerencia,
} from '../comercios/api';

export interface DireccionSugerida {
  displayName: string;
  calle: string;
  numero: string;
  localidad: string;
  provincia: string;
  latitud: number;
  longitud: number;
}

interface BuscadorDireccionProps {
  token: string | null;
  onSeleccion: (sugerencia: DireccionSugerida) => void;
}

function IconoPin() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 21s-7-5.7-7-11a7 7 0 1 1 14 0c0 5.3-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function IconoLupa() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function normalizar(detalle: PlacesDetalle): DireccionSugerida {
  return {
    displayName: detalle.direccion || detalle.nombre,
    calle: detalle.calle,
    numero: detalle.numero,
    localidad: detalle.localidad,
    provincia: detalle.provincia,
    latitud: detalle.latitud,
    longitud: detalle.longitud,
  };
}

function mensajeDeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 503) {
      return 'Google Places no está configurado. Avisá al equipo para habilitar la búsqueda de direcciones.';
    }
    return error.message;
  }
  return 'No pudimos buscar direcciones. Intentá de nuevo.';
}

export function BuscadorDireccion({
  token,
  onSeleccion,
}: BuscadorDireccionProps) {
  const [texto, setTexto] = useState('');
  const [sugerencias, setSugerencias] = useState<PlacesSugerencia[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [seleccionando, setSeleccionando] = useState(false);
  const [error, setError] = useState('');
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const consulta = texto.trim();
    if (!token || consulta.length < 3) return;

    const controlador = new AbortController();

    const temporizador = setTimeout(async () => {
      setBuscando(true);
      setError('');

      try {
        const resultados = await placesApi.autocompletar(
          token,
          consulta,
          controlador.signal,
        );
        if (controlador.signal.aborted) return;
        setSugerencias(resultados);
        setAbierto(true);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setSugerencias([]);
        setAbierto(true);
        setError(mensajeDeError(err));
      } finally {
        if (!controlador.signal.aborted) {
          setBuscando(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(temporizador);
      controlador.abort();
    };
  }, [texto, token]);

  useEffect(() => {
    function alClicFuera(evento: MouseEvent) {
      if (!contenedorRef.current?.contains(evento.target as Node)) {
        setAbierto(false);
      }
    }

    document.addEventListener('mousedown', alClicFuera);
    return () => document.removeEventListener('mousedown', alClicFuera);
  }, []);

  function cambiarTexto(evento: ChangeEvent<HTMLInputElement>) {
    const valor = evento.currentTarget.value;
    setTexto(valor);

    if (valor.trim().length < 3) {
      setSugerencias([]);
      setAbierto(false);
      setBuscando(false);
      setError('');
    }
  }

  async function seleccionar(sugerencia: PlacesSugerencia) {
    if (!token) return;

    setTexto(sugerencia.descripcion);
    setAbierto(false);
    setSeleccionando(true);
    setError('');

    try {
      const detalle = await placesApi.detalle(token, sugerencia.placeId);
      onSeleccion(normalizar(detalle));
    } catch (err) {
      setError(mensajeDeError(err));
      setAbierto(true);
    } finally {
      setSeleccionando(false);
    }
  }

  const mostrarLista = abierto && texto.trim().length >= 3;
  const cargando = buscando || seleccionando;

  return (
    <div className="buscador" ref={contenedorRef}>
      <TextInput
        placeholder="Dirección o punto de referencia"
        aria-label="Buscar dirección o punto de referencia"
        leftSection={<IconoLupa />}
        leftSectionPointerEvents="none"
        rightSection={cargando ? <Loader size="xs" /> : undefined}
        autoComplete="off"
        value={texto}
        onChange={cambiarTexto}
        onFocus={() => {
          if (sugerencias.length > 0) setAbierto(true);
        }}
        onKeyDown={(evento) => {
          if (evento.key === 'Escape') setAbierto(false);
          if (evento.key === 'Enter' && sugerencias.length > 0) {
            evento.preventDefault();
            void seleccionar(sugerencias[0]);
          }
        }}
      />

      {mostrarLista && (
        <ul className="buscador__lista" role="listbox">
          {buscando && <li className="buscador__estado">Buscando…</li>}

          {!buscando && error && (
            <li className="buscador__estado" role="alert">
              {error}
            </li>
          )}

          {!buscando && !error && sugerencias.length === 0 && (
            <li className="buscador__estado">
              No encontramos coincidencias. Probá con otra dirección.
            </li>
          )}

          {!buscando &&
            !error &&
            sugerencias.map((sugerencia) => (
              <li key={sugerencia.placeId} className="buscador__fila">
                <button
                  type="button"
                  className="buscador__item"
                  role="option"
                  aria-selected={false}
                  onClick={() => void seleccionar(sugerencia)}
                >
                  <span className="buscador__pin">
                    <IconoPin />
                  </span>
                  <span className="buscador__texto">
                    <span className="buscador__texto--principal">
                      {sugerencia.textoPrincipal || sugerencia.descripcion}
                    </span>
                    {sugerencia.textoSecundario && (
                      <span className="buscador__texto--secundario">
                        {sugerencia.textoSecundario}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
