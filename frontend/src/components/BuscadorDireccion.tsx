import { Loader, TextInput } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

export interface DireccionSugerida {
  displayName: string;
  calle: string;
  numero: string;
  localidad: string;
  provincia: string;
  latitud: number;
  longitud: number;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    pedestrian?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
  };
}

interface BuscadorDireccionProps {
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

function lineaPrincipal(sugerencia: DireccionSugerida): string {
  const calle = [sugerencia.calle, sugerencia.numero]
    .filter(Boolean)
    .join(' ')
    .trim();
  return calle || sugerencia.displayName;
}

function lineaSecundaria(sugerencia: DireccionSugerida): string {
  return [sugerencia.localidad, sugerencia.provincia]
    .filter(Boolean)
    .join(', ');
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

function normalizar(resultado: NominatimResult): DireccionSugerida {
  const direccion = resultado.address ?? {};

  return {
    displayName: resultado.display_name,
    calle: direccion.road ?? direccion.pedestrian ?? '',
    numero: direccion.house_number ?? '',
    localidad:
      direccion.city ??
      direccion.town ??
      direccion.village ??
      direccion.municipality ??
      direccion.county ??
      '',
    provincia: direccion.state ?? '',
    latitud: Number(resultado.lat),
    longitud: Number(resultado.lon),
  };
}

export function BuscadorDireccion({ onSeleccion }: BuscadorDireccionProps) {
  const [texto, setTexto] = useState('');
  const [sugerencias, setSugerencias] = useState<DireccionSugerida[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const consulta = texto.trim();
    if (consulta.length < 3) return;

    const controlador = new AbortController();

    const temporizador = setTimeout(async () => {
      setBuscando(true);
      setError('');

      try {
        const parametros = new URLSearchParams({
          format: 'json',
          addressdetails: '1',
          countrycodes: 'ar',
          limit: '6',
          'accept-language': 'es',
          q: consulta,
        });

        const respuesta = await fetch(
          `https://nominatim.openstreetmap.org/search?${parametros.toString()}`,
          {
            signal: controlador.signal,
            headers: { Accept: 'application/json' },
          },
        );

        if (!respuesta.ok) {
          throw new Error('Error de geocodificación');
        }

        const datos = (await respuesta.json()) as NominatimResult[];

        if (controlador.signal.aborted) return;

        setSugerencias(datos.map(normalizar));
        setAbierto(true);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setSugerencias([]);
        setAbierto(true);
        setError('No pudimos buscar direcciones. Intentá de nuevo.');
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
  }, [texto]);

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

  function seleccionar(sugerencia: DireccionSugerida) {
    setTexto(sugerencia.displayName);
    setAbierto(false);
    onSeleccion(sugerencia);
  }

  const mostrarLista = abierto && texto.trim().length >= 3;

  return (
    <div className="buscador" ref={contenedorRef}>
      <TextInput
        placeholder="Dirección o punto de referencia"
        aria-label="Buscar dirección o punto de referencia"
        leftSection={<IconoLupa />}
        leftSectionPointerEvents="none"
        rightSection={buscando ? <Loader size="xs" /> : undefined}
        autoComplete="off"
        value={texto}
        onChange={cambiarTexto}
        onFocus={() => {
          if (sugerencias.length > 0) setAbierto(true);
        }}
        onKeyDown={(evento) => {
          if (evento.key === 'Escape') setAbierto(false);
          if (evento.key === 'Enter') {
            evento.preventDefault();
            if (sugerencias.length > 0) {
              seleccionar(sugerencias[0]);
            }
          }
        }}
      />

      {mostrarLista && (
        <ul
          className="buscador__lista"
          id="sugerencias-direcciones"
          role="listbox"
        >
          {buscando && <li className="buscador__estado">Buscando…</li>}

          {!buscando && error && (
            <li className="buscador__estado">{error}</li>
          )}

          {!buscando && !error && sugerencias.length === 0 && (
            <li className="buscador__estado">
              No encontramos coincidencias. Probá con otra dirección.
            </li>
          )}

          {!buscando &&
            !error &&
            sugerencias.map((sugerencia) => (
              <li
                key={`${sugerencia.latitud}-${sugerencia.longitud}`}
                className="buscador__fila"
              >
                <button
                  type="button"
                  className="buscador__item"
                  role="option"
                  aria-selected={false}
                  onClick={() => seleccionar(sugerencia)}
                >
                  <span className="buscador__pin">
                    <IconoPin />
                  </span>
                  <span className="buscador__texto">
                    <span className="buscador__texto--principal">
                      {lineaPrincipal(sugerencia)}
                    </span>
                    {lineaSecundaria(sugerencia) && (
                      <span className="buscador__texto--secundario">
                        {lineaSecundaria(sugerencia)}
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
