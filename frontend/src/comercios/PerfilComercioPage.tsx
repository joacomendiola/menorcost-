import {
  Button,
  Group,
  Loader,
  Stack,
  Switch,
  Textarea,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../api';
import { useAuth } from '../auth/contexto';
import { BuscadorComercio } from './BuscadorComercio';
import { MapaComercio } from './MapaComercio';
import {
  comerciosApi,
  resolverImagen,
  type Comercio,
  type ComercioPayload,
  type EstadoComercio,
  type PlacesDetalle,
  type TipoImagenComercio,
} from './api';
import { DIAS, formatearRango, ORDEN_DIAS } from './configuracion';
import './comercios.css';

interface FormularioComercio {
  nombreFantasia: string;
  razonSocial: string;
  cuit: string;
  telefono: string;
  descripcion: string;
  logoUrl: string;
  portadaUrl: string;
  calle: string;
  numero: string;
  piso: string;
  localidad: string;
  provincia: string;
  codigoPostal: string;
  latitud: number;
  longitud: number;
  googlePlaceId: string;
}

const ESTADOS: Record<EstadoComercio, { etiqueta: string; clase: string }> = {
  PENDIENTE_VERIFICACION: {
    etiqueta: 'Pendiente de verificación',
    clase: 'comercio-estado--pendiente',
  },
  HABILITADO: { etiqueta: 'Habilitado', clase: 'comercio-estado--ok' },
  DOCUMENTACION_RECHAZADA: {
    etiqueta: 'Documentación rechazada',
    clase: 'comercio-estado--malo',
  },
  SUSPENDIDO: { etiqueta: 'Suspendido', clase: 'comercio-estado--malo' },
  ELIMINADO: { etiqueta: 'Cuenta eliminada', clase: 'comercio-estado--malo' },
};

const MAX_IMAGEN = 5 * 1024 * 1024;
const TIPOS_IMAGEN = ['image/jpeg', 'image/png'];

function validarImagen(file: File): string | null {
  if (!TIPOS_IMAGEN.includes(file.type)) {
    return 'Elegí una imagen JPG o PNG.';
  }

  if (file.size > MAX_IMAGEN) {
    return 'La imagen no puede superar los 5 MB.';
  }

  return null;
}

interface ImagenComercioProps {
  etiqueta: string;
  url: string | null;
  subiendo: boolean;
  onArchivo: (file: File) => void;
}

function ImagenComercio({
  etiqueta,
  url,
  subiendo,
  onArchivo,
}: ImagenComercioProps) {
  const imagen = resolverImagen(url);

  return (
    <div className="comercio-imagen-campo">
      <span className="mantine-InputWrapper-label">{etiqueta}</span>
      <div className="comercio-imagen-vista">
        {imagen ? (
          <img src={imagen} alt={etiqueta} />
        ) : (
          <span className="muted">Sin imagen</span>
        )}
      </div>
      <label className={`chip${subiendo ? ' chip--disabled' : ''}`}>
        {subiendo ? 'Subiendo…' : 'Subir imagen'}
        <input
          type="file"
          accept="image/jpeg,image/png"
          hidden
          disabled={subiendo}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) onArchivo(file);
          }}
        />
      </label>
      <p className="help">JPG o PNG, hasta 5 MB.</p>
    </div>
  );
}

function aFormulario(comercio: Comercio): FormularioComercio {
  return {
    nombreFantasia: comercio.nombreFantasia,
    razonSocial: comercio.razonSocial,
    cuit: comercio.cuit,
    telefono: comercio.telefono,
    descripcion: comercio.descripcion ?? '',
    logoUrl: comercio.logoUrl ?? '',
    portadaUrl: comercio.portadaUrl ?? '',
    calle: comercio.calle,
    numero: comercio.numero,
    piso: comercio.piso ?? '',
    localidad: comercio.localidad,
    provincia: comercio.provincia,
    codigoPostal: comercio.codigoPostal ?? '',
    latitud: Number(comercio.latitud),
    longitud: Number(comercio.longitud),
    googlePlaceId: comercio.googlePlaceId,
  };
}

function mensajeError(error: unknown, respaldo: string): string {
  return error instanceof ApiError ? error.message : respaldo;
}

export function PerfilComercioPage() {
  const navigate = useNavigate();
  const { token, cerrarSesion } = useAuth();

  const [comercio, setComercio] = useState<Comercio | null>(null);
  const [formulario, setFormulario] = useState<FormularioComercio | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [recargar, setRecargar] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [cambiandoApertura, setCambiandoApertura] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState('');
  const [editandoUbicacion, setEditandoUbicacion] = useState(false);
  const [subiendoImagen, setSubiendoImagen] =
    useState<TipoImagenComercio | null>(null);

  useEffect(() => {
    if (!token) return;

    let activo = true;

    async function cargar() {
      try {
        const data = await comerciosApi.mio(token!);
        if (!activo) return;

        if (!data) {
          navigate('/comercios/registro', { replace: true });
          return;
        }

        setComercio(data);
        setFormulario(aFormulario(data));
        setErrorCarga('');
      } catch (err) {
        if (!activo) return;
        if (err instanceof ApiError && err.status === 401) {
          cerrarSesion();
          navigate('/login', { replace: true });
          return;
        }
        setErrorCarga(
          mensajeError(err, 'No pudimos cargar los datos de tu comercio.'),
        );
      } finally {
        if (activo) setCargando(false);
      }
    }

    void cargar();

    return () => {
      activo = false;
    };
  }, [token, cerrarSesion, navigate, recargar]);

  function campo(campoFormulario: keyof FormularioComercio) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const valor = event.currentTarget.value;
      setFormulario((prev) =>
        prev ? { ...prev, [campoFormulario]: valor } : prev,
      );
    };
  }

  function seleccionarUbicacion(detalle: PlacesDetalle) {
    setFormulario((prev) =>
      prev
        ? {
            ...prev,
            calle: detalle.calle || detalle.direccion,
            numero: detalle.numero,
            localidad: detalle.localidad || prev.localidad,
            provincia: detalle.provincia || prev.provincia,
            codigoPostal: detalle.codigoPostal || prev.codigoPostal,
            latitud: detalle.latitud,
            longitud: detalle.longitud,
            googlePlaceId: detalle.placeId,
          }
        : prev,
    );
    setEditandoUbicacion(false);
    setErrorFormulario('');
    notifications.show({
      color: 'green',
      message: 'Ubicación actualizada. Guardá los cambios para confirmarla.',
    });
  }

  async function cambiarApertura(abierto: boolean) {
    if (!token) return;
    setCambiandoApertura(true);

    try {
      const resultado = await comerciosApi.cambiarApertura(token, abierto);
      setComercio((prev) =>
        prev ? { ...prev, abierto: resultado.abierto } : prev,
      );
      notifications.show({
        message: resultado.abierto
          ? 'Tu comercio figura abierto.'
          : 'Tu comercio figura cerrado.',
      });
    } catch (err) {
      notifications.show({
        color: 'red',
        message: mensajeError(err, 'No pudimos cambiar el estado del local.'),
      });
    } finally {
      setCambiandoApertura(false);
    }
  }

  async function subirImagen(tipo: TipoImagenComercio, file: File) {
    if (!token) return;

    const errorImagen = validarImagen(file);
    if (errorImagen) {
      notifications.show({ color: 'red', message: errorImagen });
      return;
    }

    setSubiendoImagen(tipo);

    try {
      const actualizado = await comerciosApi.subirImagen(token, tipo, file);
      setComercio(actualizado);
      setFormulario(aFormulario(actualizado));
      notifications.show({
        color: 'green',
        message:
          tipo === 'logo'
            ? 'Logo actualizado correctamente.'
            : 'Portada actualizada correctamente.',
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        cerrarSesion();
        navigate('/login', { replace: true });
        return;
      }
      notifications.show({
        color: 'red',
        message: mensajeError(err, 'No pudimos subir la imagen.'),
      });
    } finally {
      setSubiendoImagen(null);
    }
  }

  async function guardar(event: FormEvent) {
    event.preventDefault();
    if (!token || !formulario || !comercio) return;

    if (formulario.nombreFantasia.trim().length < 2) {
      setErrorFormulario('El nombre de fantasía es obligatorio.');
      return;
    }
    if (formulario.razonSocial.trim().length < 2) {
      setErrorFormulario('La razón social es obligatoria.');
      return;
    }
    if (!/^\d{11}$/.test(formulario.cuit.trim())) {
      setErrorFormulario('El CUIT debe tener 11 dígitos.');
      return;
    }
    if (formulario.telefono.trim().length < 6) {
      setErrorFormulario('Ingresá un teléfono de contacto.');
      return;
    }
    if (!formulario.calle.trim() || !formulario.numero.trim()) {
      setErrorFormulario('Completá la calle y el número.');
      return;
    }
    if (!formulario.localidad.trim() || !formulario.provincia.trim()) {
      setErrorFormulario('Completá la localidad y la provincia.');
      return;
    }

    const payload: Partial<ComercioPayload> = {
      nombreFantasia: formulario.nombreFantasia.trim(),
      razonSocial: formulario.razonSocial.trim(),
      cuit: formulario.cuit.replace(/\D/g, ''),
      telefono: formulario.telefono.trim(),
      descripcion: formulario.descripcion.trim() || undefined,
      calle: formulario.calle.trim(),
      numero: formulario.numero.trim(),
      piso: formulario.piso.trim() || undefined,
      localidad: formulario.localidad.trim(),
      provincia: formulario.provincia.trim(),
      codigoPostal: formulario.codigoPostal.trim() || undefined,
      latitud: formulario.latitud,
      longitud: formulario.longitud,
      googlePlaceId: formulario.googlePlaceId,
      logoUrl: formulario.logoUrl.trim() || undefined,
      portadaUrl: formulario.portadaUrl.trim() || undefined,
    };

    setGuardando(true);
    setErrorFormulario('');

    try {
      const actualizado = await comerciosApi.actualizar(token, payload);
      setComercio(actualizado);
      setFormulario(aFormulario(actualizado));
      notifications.show({
        color: 'green',
        message: 'Cambios guardados exitosamente.',
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        cerrarSesion();
        navigate('/login', { replace: true });
        return;
      }
      setErrorFormulario(
        mensajeError(err, 'No pudimos guardar los cambios del comercio.'),
      );
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

  if (errorCarga || !comercio || !formulario) {
    return (
      <main className="comercio-page">
        <div className="card">
          <div className="panel panel--bad">
            {errorCarga || 'No pudimos cargar tu comercio.'}
          </div>
          <Button
            fullWidth
            mt="md"
            onClick={() => {
              setCargando(true);
              setRecargar((prev) => prev + 1);
            }}
          >
            Reintentar
          </Button>
        </div>
      </main>
    );
  }

  const estado = ESTADOS[comercio.estado];
  const portada = resolverImagen(comercio.portadaUrl);
  const logo = resolverImagen(comercio.logoUrl);
  const horariosPorDia = ORDEN_DIAS.map((dia) => ({
    dia,
    horarios: comercio.horarios.filter((horario) => horario.diaSemana === dia),
  })).filter(({ horarios }) => horarios.length > 0);

  return (
    <main className="comercio-page">
      <button type="button" className="chip" onClick={() => navigate(-1)}>
        ← Volver
      </button>

      <div className="card comercio-cabecera" style={{ marginTop: 14 }}>
        <div
          className="comercio-portada"
          style={portada ? { backgroundImage: `url(${portada})` } : undefined}
        />
        <div className="comercio-cabecera__cuerpo">
          {logo ? (
            <img
              className="comercio-logo"
              src={logo}
              alt={`Logo de ${comercio.nombreFantasia}`}
            />
          ) : (
            <div className="comercio-logo" aria-hidden="true">
              🏪
            </div>
          )}
          <div className="comercio-cabecera__texto">
            <h1>{comercio.nombreFantasia}</h1>
            <div className="comercio-cabecera__meta">
              <span className={`comercio-estado ${estado.clase}`}>
                {estado.etiqueta}
              </span>
              <span className="muted">
                {comercio.calle} {comercio.numero}, {comercio.localidad}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <Group justify="space-between" align="center">
          <div>
            <h3>Apertura del local</h3>
            <p className="help">
              Los clientes solo pueden comprar si el local figura abierto.
            </p>
          </div>
          <Switch
            size="md"
            label={comercio.abierto ? 'Abierto' : 'Cerrado'}
            checked={comercio.abierto}
            disabled={cambiandoApertura}
            onChange={(event) =>
              void cambiarApertura(event.currentTarget.checked)
            }
          />
        </Group>

        <div className="comercio-acciones">
          <div className="comercio-acciones__grupo">
            <Button
              variant="default"
              onClick={() => navigate('/comercios/horarios')}
            >
              Configurar horarios y franjas
            </Button>
            {comercio.estado === 'HABILITADO' && (
              <Button
                variant="default"
                onClick={() => navigate(`/comercios/${comercio.id}`)}
              >
                Ver tienda pública
              </Button>
            )}
          </div>
          <span className="muted">
            {comercio.mercadoPagoVinculado
              ? 'Mercado Pago vinculado'
              : 'Mercado Pago sin vincular'}
          </span>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 8 }}>Horarios de atención</h3>
        {horariosPorDia.length === 0 ? (
          <p className="muted">Todavía no configuraste horarios.</p>
        ) : (
          <div>
            {horariosPorDia.map(({ dia, horarios }) => (
              <div key={dia} className="comercio-preview__fila">
                <span>{DIAS[dia]}</span>
                <span>
                  {horarios
                    .map((horario) => formatearRango(horario))
                    .join(' · ')}
                </span>
              </div>
            ))}
          </div>
        )}

        <h3 style={{ margin: '18px 0 8px' }}>Franjas de retiro</h3>
        {comercio.franjas.length === 0 ? (
          <p className="muted">Todavía no configuraste franjas de retiro.</p>
        ) : (
          <div>
            {ORDEN_DIAS.map((dia) => {
              const delDia = comercio.franjas.filter(
                (franja) => franja.diaSemana === dia,
              );
              if (delDia.length === 0) return null;

              return (
                <div key={dia} className="comercio-preview__fila">
                  <span>{DIAS[dia]}</span>
                  <span>
                    {delDia
                      .map(
                        (franja) =>
                          `${formatearRango(franja)}${franja.activa ? '' : ' (inactiva)'}`,
                      )
                      .join(' · ')}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <form className="card" onSubmit={guardar}>
        <Stack gap={14}>
          <h3>Datos del comercio</h3>

          <div className="grid-2">
            <TextInput
              label="Nombre de fantasía"
              required
              value={formulario.nombreFantasia}
              onChange={campo('nombreFantasia')}
            />
            <TextInput
              label="Razón social"
              required
              value={formulario.razonSocial}
              onChange={campo('razonSocial')}
            />
          </div>

          <div className="grid-2">
            <TextInput
              label="CUIT"
              required
              maxLength={11}
              value={formulario.cuit}
              onChange={campo('cuit')}
            />
            <TextInput
              label="Teléfono"
              required
              value={formulario.telefono}
              onChange={campo('telefono')}
            />
          </div>

          <Textarea
            label="Descripción"
            autosize
            minRows={3}
            placeholder="Contá qué ofrece tu comercio"
            value={formulario.descripcion}
            onChange={campo('descripcion')}
          />

          <div className="grid-2">
            <ImagenComercio
              etiqueta="Logo"
              url={formulario.logoUrl}
              subiendo={subiendoImagen === 'logo'}
              onArchivo={(file) => void subirImagen('logo', file)}
            />
            <ImagenComercio
              etiqueta="Portada"
              url={formulario.portadaUrl}
              subiendo={subiendoImagen === 'portada'}
              onArchivo={(file) => void subirImagen('portada', file)}
            />
          </div>

          <h3 style={{ marginTop: 6 }}>Ubicación</h3>

          <Button
            type="button"
            variant="default"
            onClick={() => setEditandoUbicacion((prev) => !prev)}
          >
            {editandoUbicacion
              ? 'Cancelar búsqueda de ubicación'
              : 'Cambiar ubicación con Google Places'}
          </Button>

          {editandoUbicacion && (
            <BuscadorComercio
              token={token!}
              onSeleccion={seleccionarUbicacion}
            />
          )}

          <MapaComercio
            latitud={formulario.latitud}
            longitud={formulario.longitud}
          />

          <div className="grid-2">
            <TextInput
              label="Calle"
              required
              value={formulario.calle}
              onChange={campo('calle')}
            />
            <div className="grid-2">
              <TextInput
                label="Número"
                required
                value={formulario.numero}
                onChange={campo('numero')}
              />
              <TextInput
                label="Piso / Depto"
                placeholder="Opcional"
                value={formulario.piso}
                onChange={campo('piso')}
              />
            </div>
          </div>

          <div className="grid-2">
            <TextInput
              label="Localidad"
              required
              value={formulario.localidad}
              onChange={campo('localidad')}
            />
            <div className="grid-2">
              <TextInput
                label="Provincia"
                required
                value={formulario.provincia}
                onChange={campo('provincia')}
              />
              <TextInput
                label="Código postal"
                placeholder="Opcional"
                value={formulario.codigoPostal}
                onChange={campo('codigoPostal')}
              />
            </div>
          </div>

          <div className="grid-2">
            <TextInput
              label="Latitud"
              value={formulario.latitud.toFixed(6)}
              disabled
            />
            <TextInput
              label="Longitud"
              value={formulario.longitud.toFixed(6)}
              disabled
            />
          </div>

          {errorFormulario && (
            <p style={{ color: 'var(--bad)', fontSize: 13 }} role="alert">
              {errorFormulario}
            </p>
          )}

          <Group justify="flex-end">
            <Button type="submit" loading={guardando}>
              Guardar cambios
            </Button>
          </Group>
        </Stack>
      </form>
    </main>
  );
}
