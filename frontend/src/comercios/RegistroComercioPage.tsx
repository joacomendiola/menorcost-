import {
  Button,
  Loader,
  Stack,
  Stepper,
  Textarea,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../api';
import { useAuth } from '../auth/contexto';
import { BuscadorComercio } from './BuscadorComercio';
import { HorariosEditor } from './HorariosEditor';
import { MapaComercio } from './MapaComercio';
import {
  comerciosApi,
  type ComercioPayload,
  type FranjaPayload,
  type HorarioPayload,
  type PlacesDetalle,
} from './api';
import { validarConfiguracion } from './configuracion';
import './comercios.css';

interface DatosComercio {
  nombreFantasia: string;
  razonSocial: string;
  cuit: string;
  telefono: string;
  descripcion: string;
  logoUrl: string;
  portadaUrl: string;
}

interface DireccionComercio {
  calle: string;
  numero: string;
  piso: string;
  localidad: string;
  provincia: string;
  codigoPostal: string;
  latitud: number;
  longitud: number;
}

const DATOS_INICIALES: DatosComercio = {
  nombreFantasia: '',
  razonSocial: '',
  cuit: '',
  telefono: '',
  descripcion: '',
  logoUrl: '',
  portadaUrl: '',
};

const DIRECCION_INICIAL: DireccionComercio = {
  calle: '',
  numero: '',
  piso: '',
  localidad: 'Ushuaia',
  provincia: 'Tierra del Fuego',
  codigoPostal: '',
  latitud: -54.8073,
  longitud: -68.3084,
};

function mensajeError(error: unknown, respaldo: string): string {
  return error instanceof ApiError ? error.message : respaldo;
}

export function RegistroComercioPage() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [paso, setPaso] = useState(0);
  const [datos, setDatos] = useState<DatosComercio>(DATOS_INICIALES);
  const [ubicacion, setUbicacion] = useState<PlacesDetalle | null>(null);
  const [direccion, setDireccion] =
    useState<DireccionComercio>(DIRECCION_INICIAL);
  const [horarios, setHorarios] = useState<HorarioPayload[]>([]);
  const [franjas, setFranjas] = useState<FranjaPayload[]>([]);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!token) return;

    let activo = true;

    async function comprobar() {
      try {
        const comercio = await comerciosApi.mio(token!);
        if (!activo) return;

        if (comercio) {
          navigate('/comercios/perfil', { replace: true });
          return;
        }

        setErrorCarga('');
      } catch (err) {
        if (!activo) return;
        setErrorCarga(
          mensajeError(err, 'No pudimos verificar si ya tenés un comercio.'),
        );
      } finally {
        if (activo) setCargando(false);
      }
    }

    void comprobar();

    return () => {
      activo = false;
    };
  }, [token, navigate]);

  function campoDatos(campo: keyof DatosComercio) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const valor = event.currentTarget.value;
      setDatos((prev) => ({ ...prev, [campo]: valor }));
    };
  }

  function campoDireccion(campo: keyof DireccionComercio) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const valor = event.currentTarget.value;
      setDireccion((prev) => ({ ...prev, [campo]: valor }));
    };
  }

  function seleccionarUbicacion(detalle: PlacesDetalle) {
    setUbicacion(detalle);
    setDireccion({
      calle: detalle.calle || detalle.direccion,
      numero: detalle.numero,
      piso: '',
      localidad: detalle.localidad || 'Ushuaia',
      provincia: detalle.provincia || 'Tierra del Fuego',
      codigoPostal: detalle.codigoPostal,
      latitud: detalle.latitud,
      longitud: detalle.longitud,
    });
    setError('');
  }

  function validarPasoDatos(): boolean {
    if (datos.nombreFantasia.trim().length < 2) {
      setError('Ingresá el nombre de fantasía del comercio.');
      return false;
    }
    if (datos.razonSocial.trim().length < 2) {
      setError('Ingresá la razón social.');
      return false;
    }
    if (!/^\d{11}$/.test(datos.cuit.trim())) {
      setError('El CUIT debe tener 11 dígitos.');
      return false;
    }
    if (datos.telefono.trim().length < 6) {
      setError('Ingresá un teléfono de contacto.');
      return false;
    }
    setError('');
    return true;
  }

  function validarPasoUbicacion(): boolean {
    if (!ubicacion) {
      setError('Buscá y seleccioná tu local en Google Places.');
      return false;
    }
    if (!direccion.calle.trim() || !direccion.numero.trim()) {
      setError('Completá la calle y el número del local.');
      return false;
    }
    if (!direccion.localidad.trim() || !direccion.provincia.trim()) {
      setError('Completá la localidad y la provincia.');
      return false;
    }
    setError('');
    return true;
  }

  function siguiente() {
    if (paso === 0 && !validarPasoDatos()) return;
    if (paso === 1 && !validarPasoUbicacion()) return;
    setPaso((prev) => Math.min(prev + 1, 2));
  }

  async function guardar() {
    if (!token || !ubicacion) return;

    if (!validarPasoDatos() || !validarPasoUbicacion()) {
      setPaso(ubicacion ? 0 : 1);
      return;
    }

    const errorConfiguracion = validarConfiguracion(horarios, franjas);
    if (errorConfiguracion) {
      setError(errorConfiguracion);
      return;
    }

    const payload: ComercioPayload = {
      nombreFantasia: datos.nombreFantasia.trim(),
      razonSocial: datos.razonSocial.trim(),
      cuit: datos.cuit.replace(/\D/g, ''),
      telefono: datos.telefono.trim(),
      descripcion: datos.descripcion.trim() || undefined,
      calle: direccion.calle.trim(),
      numero: direccion.numero.trim(),
      piso: direccion.piso.trim() || undefined,
      localidad: direccion.localidad.trim(),
      provincia: direccion.provincia.trim(),
      codigoPostal: direccion.codigoPostal.trim() || undefined,
      latitud: direccion.latitud,
      longitud: direccion.longitud,
      googlePlaceId: ubicacion.placeId,
      logoUrl: datos.logoUrl.trim() || undefined,
      portadaUrl: datos.portadaUrl.trim() || undefined,
    };

    setGuardando(true);
    setError('');

    try {
      await comerciosApi.crear(token, payload);

      try {
        await comerciosApi.guardarConfiguracionHoraria(token, {
          horarios,
          franjas,
        });
      } catch (err) {
        notifications.show({
          color: 'yellow',
          message: `El comercio se creó, pero no pudimos guardar los horarios: ${mensajeError(
            err,
            'error desconocido',
          )}`,
        });
      }

      notifications.show({
        color: 'green',
        message: '¡Comercio creado! Ya podés completar tu perfil.',
      });
      navigate('/comercios/perfil', { replace: true });
    } catch (err) {
      setError(mensajeError(err, 'No pudimos crear el comercio.'));
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <main className="comercio-page">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader color="brand" />
        </div>
      </main>
    );
  }

  if (errorCarga) {
    return (
      <main className="comercio-page">
        <div className="card">
          <div className="panel panel--bad">{errorCarga}</div>
          <Button fullWidth mt="md" onClick={() => window.location.reload()}>
            Reintentar
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="comercio-page">
      <button type="button" className="chip" onClick={() => navigate(-1)}>
        ← Volver
      </button>

      <h1 style={{ margin: '14px 0 6px' }}>🏪 Registrar mi comercio</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Completá los datos del local, ubicá la dirección y definí tus horarios y
        franjas de retiro.
      </p>

      <div className="card">
        <Stepper
          active={paso}
          onStepClick={setPaso}
          allowNextStepsSelect={false}
          size="sm"
        >
          <Stepper.Step label="Datos" description="Información del local" />
          <Stepper.Step label="Ubicación" description="Dirección y mapa" />
          <Stepper.Step label="Horarios" description="Atención y retiro" />
        </Stepper>
      </div>

      {error && (
        <div
          className="panel panel--bad"
          style={{ marginTop: 14 }}
          role="alert"
        >
          {error}
        </div>
      )}

      {paso === 0 && (
        <div className="card">
          <Stack gap={14}>
            <div className="grid-2">
              <TextInput
                label="Nombre de fantasía"
                placeholder="Ej.: Almacén del Sur"
                required
                value={datos.nombreFantasia}
                onChange={campoDatos('nombreFantasia')}
              />
              <TextInput
                label="Razón social"
                placeholder="Razón social de la empresa"
                required
                value={datos.razonSocial}
                onChange={campoDatos('razonSocial')}
              />
            </div>

            <div className="grid-2">
              <TextInput
                label="CUIT"
                placeholder="20123456786"
                required
                maxLength={11}
                value={datos.cuit}
                onChange={campoDatos('cuit')}
              />
              <TextInput
                label="Teléfono"
                placeholder="2901 555555"
                required
                value={datos.telefono}
                onChange={campoDatos('telefono')}
              />
            </div>

            <Textarea
              label="Descripción"
              placeholder="Contá qué ofrece tu comercio (opcional)"
              autosize
              minRows={3}
              value={datos.descripcion}
              onChange={campoDatos('descripcion')}
            />

            <div className="grid-2">
              <TextInput
                label="Logo (URL)"
                placeholder="https://… (opcional)"
                value={datos.logoUrl}
                onChange={campoDatos('logoUrl')}
              />
              <TextInput
                label="Portada (URL)"
                placeholder="https://… (opcional)"
                value={datos.portadaUrl}
                onChange={campoDatos('portadaUrl')}
              />
            </div>
            <p className="help">
              Por ahora las imágenes se cargan con una URL pública. La subida de
              archivos queda para una próxima iteración.
            </p>
          </Stack>
        </div>
      )}

      {paso === 1 && (
        <div className="card">
          <Stack gap={14}>
            <BuscadorComercio
              token={token!}
              onSeleccion={seleccionarUbicacion}
            />

            {ubicacion ? (
              <>
                <div className="comercio-preview">
                  <div className="comercio-preview__fila">
                    <span>Lugar</span>
                    <span>{ubicacion.nombre}</span>
                  </div>
                  <div className="comercio-preview__fila">
                    <span>Dirección</span>
                    <span>{ubicacion.direccion}</span>
                  </div>
                  <div className="comercio-preview__fila">
                    <span>Coordenadas</span>
                    <span>
                      {direccion.latitud.toFixed(6)},{' '}
                      {direccion.longitud.toFixed(6)}
                    </span>
                  </div>
                </div>

                <MapaComercio
                  latitud={direccion.latitud}
                  longitud={direccion.longitud}
                />

                <div className="grid-2">
                  <TextInput
                    label="Calle"
                    value={direccion.calle}
                    onChange={campoDireccion('calle')}
                  />
                  <div className="grid-2">
                    <TextInput
                      label="Número"
                      value={direccion.numero}
                      onChange={campoDireccion('numero')}
                    />
                    <TextInput
                      label="Piso / Depto"
                      placeholder="Opcional"
                      value={direccion.piso}
                      onChange={campoDireccion('piso')}
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <TextInput
                    label="Localidad"
                    value={direccion.localidad}
                    onChange={campoDireccion('localidad')}
                  />
                  <div className="grid-2">
                    <TextInput
                      label="Provincia"
                      value={direccion.provincia}
                      onChange={campoDireccion('provincia')}
                    />
                    <TextInput
                      label="Código postal"
                      placeholder="Opcional"
                      value={direccion.codigoPostal}
                      onChange={campoDireccion('codigoPostal')}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="panel">
                Buscá tu local por nombre o dirección y elegí un resultado para
                completar la ubicación automáticamente.
              </div>
            )}
          </Stack>
        </div>
      )}

      {paso === 2 && (
        <div className="card">
          <HorariosEditor
            horarios={horarios}
            franjas={franjas}
            onChange={(nuevosHorarios, nuevasFranjas) => {
              setHorarios(nuevosHorarios);
              setFranjas(nuevasFranjas);
              setError('');
            }}
          />

          {horarios.length === 0 && (
            <div className="comercio-aviso" style={{ marginTop: 14 }}>
              Todavía no cargaste horarios. El comercio quedará cerrado hasta
              que los configures desde su perfil.
            </div>
          )}
        </div>
      )}

      <div className="comercio-acciones">
        <div className="comercio-acciones__grupo">
          {paso > 0 && (
            <Button
              variant="default"
              onClick={() => setPaso((prev) => Math.max(prev - 1, 0))}
              disabled={guardando}
            >
              Atrás
            </Button>
          )}
        </div>

        <div className="comercio-acciones__grupo">
          {paso < 2 ? (
            <Button onClick={siguiente}>Continuar</Button>
          ) : (
            <Button onClick={() => void guardar()} loading={guardando}>
              Crear comercio
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
