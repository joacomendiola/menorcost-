import {
  Button,
  Group,
  Loader,
  Modal,
  PasswordInput,
  Select,
  Stack,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ApiError,
  authApi,
  bajasApi,
  direccionesApi,
  usuariosApi,
  type Direccion,
  type DireccionPayload,
  type Perfil as PerfilData,
} from '../api';
import { useAuth } from '../auth/contexto';
import { BuscadorDireccion } from '../components/BuscadorDireccion';
import { MapaUbicacion } from '../components/MapaUbicacion';
import { PageShell } from '../components/PageShell';

const MOTIVOS_BAJA = [
  'Ya no uso la plataforma',
  'Problemas con un comercio',
  'Otro motivo',
];

interface DatosPersonales {
  nombre: string;
  apellido: string;
  telefono: string;
}

interface FormularioDireccion {
  etiqueta: string;
  calle: string;
  numero: string;
  piso: string;
  localidad: string;
  descripcion: string;
  latitud: string;
  longitud: string;
}

const DIRECCION_INICIAL: FormularioDireccion = {
  etiqueta: '',
  calle: '',
  numero: '',
  piso: '',
  localidad: 'Ushuaia',
  descripcion: '',
  latitud: '-54.807300',
  longitud: '-68.308400',
};

function formatearFecha(valor: string): string {
  const [anio, mes, dia] = valor.slice(0, 10).split('-');
  if (!anio || !mes || !dia) return valor;
  return `${dia}/${mes}/${anio}`;
}

function aFormulario(direccion: Direccion): FormularioDireccion {
  return {
    etiqueta: direccion.etiqueta,
    calle: direccion.calle,
    numero: direccion.numero,
    piso: direccion.piso ?? '',
    localidad: direccion.localidad,
    descripcion: direccion.descripcion ?? '',
    latitud: Number(direccion.latitud).toFixed(6),
    longitud: Number(direccion.longitud).toFixed(6),
  };
}

export function Perfil() {
  const navigate = useNavigate();
  const { token, cerrarSesion, actualizarUsuario } = useAuth();

  const [perfil, setPerfil] = useState<PerfilData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');

  const [datos, setDatos] = useState<DatosPersonales>({
    nombre: '',
    apellido: '',
    telefono: '',
  });
  const [guardandoDatos, setGuardandoDatos] = useState(false);
  const [datosGuardados, setDatosGuardados] = useState(false);

  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formDireccion, setFormDireccion] =
    useState<FormularioDireccion>(DIRECCION_INICIAL);
  const [errorDireccion, setErrorDireccion] = useState('');
  const [guardandoDireccion, setGuardandoDireccion] = useState(false);
  const [eliminarId, setEliminarId] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [ubicando, setUbicando] = useState(false);

  const [bajaAbierta, setBajaAbierta] = useState(false);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [passwordBaja, setPasswordBaja] = useState('');
  const [errorBaja, setErrorBaja] = useState('');
  const [enviandoBaja, setEnviandoBaja] = useState(false);
  const [bajaEnviada, setBajaEnviada] = useState(false);

  const cargarPerfil = useCallback(async () => {
    if (!token) return;
    try {
      const data = await usuariosApi.perfil(token);
      setPerfil(data);
      setDatos({
        nombre: data.nombre,
        apellido: data.apellido,
        telefono: data.telefono,
      });
      setErrorCarga('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        cerrarSesion();
        navigate('/login', { replace: true });
        return;
      }
      setErrorCarga(
        err instanceof ApiError
          ? err.message
          : 'No pudimos cargar tu perfil. Intentá de nuevo.',
      );
    } finally {
      setCargando(false);
    }
  }, [token, cerrarSesion, navigate]);

  useEffect(() => {
    if (!token) return;

    let activo = true;

    async function cargar() {
      try {
        const data = await usuariosApi.perfil(token!);
        if (!activo) return;
        setPerfil(data);
        setDatos({
          nombre: data.nombre,
          apellido: data.apellido,
          telefono: data.telefono,
        });
        setErrorCarga('');
      } catch (err) {
        if (!activo) return;
        if (err instanceof ApiError && err.status === 401) {
          cerrarSesion();
          navigate('/login', { replace: true });
          return;
        }
        setErrorCarga(
          err instanceof ApiError
            ? err.message
            : 'No pudimos cargar tu perfil. Intentá de nuevo.',
        );
      } finally {
        if (activo) setCargando(false);
      }
    }

    void cargar();

    return () => {
      activo = false;
    };
  }, [token, cerrarSesion, navigate]);

  function notificar(texto: string) {
    notifications.show({ message: texto });
  }

  async function guardarDatos(event: FormEvent) {
    event.preventDefault();
    if (!token) return;

    if (datos.nombre.trim().length < 2 || datos.apellido.trim().length < 2) {
      notificar('Nombre y apellido deben tener al menos 2 caracteres');
      return;
    }

    setGuardandoDatos(true);
    setDatosGuardados(false);
    try {
      const actualizado = await usuariosApi.actualizar(token, {
        nombre: datos.nombre.trim(),
        apellido: datos.apellido.trim(),
        telefono: datos.telefono.trim(),
      });
      setPerfil((prev) => (prev ? { ...prev, ...actualizado } : prev));
      actualizarUsuario({
        nombre: actualizado.nombre,
        apellido: actualizado.apellido,
      });
      setDatosGuardados(true);
      notificar('Cambios guardados exitosamente.');
    } catch (err) {
      notificar(
        err instanceof ApiError
          ? err.message
          : 'No pudimos guardar los cambios.',
      );
    } finally {
      setGuardandoDatos(false);
    }
  }

  function abrirNuevaDireccion() {
    setEditandoId(null);
    setFormDireccion(DIRECCION_INICIAL);
    setErrorDireccion('');
    setFormAbierto(true);
  }

  function editarDireccion(direccion: Direccion) {
    setEditandoId(direccion.id);
    setFormDireccion(aFormulario(direccion));
    setErrorDireccion('');
    setFormAbierto(true);
  }

  function campoDireccion(campo: keyof FormularioDireccion) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const valor = event.currentTarget.value;
      setFormDireccion((prev) => ({ ...prev, [campo]: valor }));
    };
  }

  function usarUbicacion() {
    if (!navigator.geolocation) {
      notificar('Tu navegador no permite obtener la ubicación');
      return;
    }

    setUbicando(true);
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        setFormDireccion((prev) => ({
          ...prev,
          latitud: posicion.coords.latitude.toFixed(6),
          longitud: posicion.coords.longitude.toFixed(6),
        }));
        setUbicando(false);
      },
      () => {
        notificar('No pudimos obtener tu ubicación');
        setUbicando(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function guardarDireccion(event: FormEvent) {
    event.preventDefault();
    if (!token) return;

    const latitud = Number(formDireccion.latitud);
    const longitud = Number(formDireccion.longitud);

    if (!formDireccion.etiqueta.trim()) {
      setErrorDireccion('La etiqueta es obligatoria');
      return;
    }
    if (!formDireccion.calle.trim() || !formDireccion.numero.trim()) {
      setErrorDireccion('Completá la calle y el número');
      return;
    }
    if (!formDireccion.localidad.trim()) {
      setErrorDireccion('La localidad es obligatoria');
      return;
    }
    if (
      !Number.isFinite(latitud) ||
      latitud < -90 ||
      latitud > 90 ||
      !Number.isFinite(longitud) ||
      longitud < -180 ||
      longitud > 180
    ) {
      setErrorDireccion('Las coordenadas no son válidas');
      return;
    }

    const payload: DireccionPayload = {
      etiqueta: formDireccion.etiqueta.trim(),
      calle: formDireccion.calle.trim(),
      numero: formDireccion.numero.trim(),
      piso: formDireccion.piso.trim() || undefined,
      localidad: formDireccion.localidad.trim(),
      descripcion: formDireccion.descripcion.trim() || undefined,
      latitud,
      longitud,
    };

    setGuardandoDireccion(true);
    setErrorDireccion('');
    try {
      if (editandoId) {
        await direccionesApi.actualizar(token, editandoId, payload);
        notificar('Dirección actualizada');
      } else {
        await direccionesApi.crear(token, payload);
        notificar('Dirección guardada');
      }
      setFormAbierto(false);
      setEditandoId(null);
      setFormDireccion(DIRECCION_INICIAL);
      await cargarPerfil();
    } catch (err) {
      setErrorDireccion(
        err instanceof ApiError
          ? err.message
          : 'No pudimos guardar la dirección.',
      );
    } finally {
      setGuardandoDireccion(false);
    }
  }

  async function confirmarEliminar() {
    if (!token || !eliminarId) return;
    setEliminando(true);
    try {
      await direccionesApi.eliminar(token, eliminarId);
      setEliminarId(null);
      notificar('Dirección eliminada');
      await cargarPerfil();
    } catch (err) {
      notificar(
        err instanceof ApiError
          ? err.message
          : 'No pudimos eliminar la dirección.',
      );
    } finally {
      setEliminando(false);
    }
  }

  async function hacerPredeterminada(id: string) {
    if (!token) return;
    try {
      await direccionesApi.marcarPredeterminada(token, id);
      notificar('Dirección predeterminada actualizada');
      await cargarPerfil();
    } catch (err) {
      notificar(
        err instanceof ApiError
          ? err.message
          : 'No pudimos actualizar la dirección.',
      );
    }
  }

  async function enviarBaja(event: FormEvent) {
    event.preventDefault();
    if (!token) return;

    if (!motivo) {
      setErrorBaja('Elegí un motivo');
      return;
    }
    if (passwordBaja.length < 8) {
      setErrorBaja('Ingresá tu contraseña actual');
      return;
    }

    setEnviandoBaja(true);
    setErrorBaja('');
    try {
      await bajasApi.solicitar(token, motivo, passwordBaja);
      setBajaEnviada(true);
      setBajaAbierta(false);
      setPerfil((prev) =>
        prev ? { ...prev, estado: 'SOLICITUD_BAJA_PENDIENTE' } : prev,
      );
      actualizarUsuario({ estado: 'SOLICITUD_BAJA_PENDIENTE' });
      notificar('Solicitud de baja enviada a revisión');
    } catch (err) {
      setErrorBaja(
        err instanceof ApiError
          ? err.message
          : 'No pudimos enviar la solicitud de baja.',
      );
    } finally {
      setEnviandoBaja(false);
    }
  }

  async function solicitarCambioPassword() {
    if (!perfil) return;
    try {
      await authApi.olvidarPassword(perfil.email);
      notificar('Te enviamos un enlace para cambiar la contraseña');
    } catch (err) {
      notificar(
        err instanceof ApiError
          ? err.message
          : 'No pudimos enviar el enlace.',
      );
    }
  }

  function salir() {
    cerrarSesion();
    navigate('/login', { replace: true });
  }

  if (cargando) {
    return (
      <PageShell variant="profile">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader color="brand" />
        </div>
      </PageShell>
    );
  }

  if (!perfil) {
    return (
      <PageShell variant="profile">
        <div className="card">
          <div className="panel panel--bad">
            {errorCarga || 'No pudimos cargar tu perfil.'}
          </div>
          <Button
            fullWidth
            style={{ marginTop: 16 }}
            onClick={() => {
              setCargando(true);
              void cargarPerfil();
            }}
          >
            Reintentar
          </Button>
        </div>
      </PageShell>
    );
  }

  const esCliente = perfil.rol === 'CLIENTE';
  const bajaPendiente = perfil.estado === 'SOLICITUD_BAJA_PENDIENTE';

  const latitudNumero = Number(formDireccion.latitud);
  const longitudNumero = Number(formDireccion.longitud);
  const latitudMapa =
    Number.isFinite(latitudNumero) &&
    latitudNumero >= -90 &&
    latitudNumero <= 90
      ? latitudNumero
      : -54.8073;
  const longitudMapa =
    Number.isFinite(longitudNumero) &&
    longitudNumero >= -180 &&
    longitudNumero <= 180
      ? longitudNumero
      : -68.3084;

  const accesos: Array<{ icono: string; texto: string; ruta?: string }> =
    perfil.rol === 'ADMINISTRADOR'
      ? [{ icono: '🛡', texto: 'Backoffice' }]
      : perfil.rol === 'COMERCIANTE'
        ? [
            { icono: '📦', texto: 'Productos' },
            { icono: '🏪', texto: 'Mi local', ruta: '/comercios/perfil' },
            { icono: '⭐', texto: 'Reputación' },
          ]
        : [
            { icono: '📦', texto: 'Mis pedidos' },
            { icono: '🧺', texto: 'Mis canastas' },
            { icono: '🔎', texto: 'Buscar ofertas' },
            {
              icono: '🏪',
              texto: 'Mi comercio',
              ruta: '/comercios/registro',
            },
          ];

  return (
    <PageShell variant="profile">
      <button type="button" className="chip" onClick={() => navigate(-1)}>
        ← Volver
      </button>

      <h1 style={{ margin: '14px 0 16px' }}>👤 Mi Perfil y Configuración</h1>

      <div className="card card--left">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
          }}
        >
          {accesos.map((acceso) => (
            <button
              key={acceso.texto}
              type="button"
              className="chip chip--active"
              onClick={() =>
                acceso.ruta
                  ? navigate(acceso.ruta)
                  : notificar('Disponible en el próximo módulo')
              }
            >
              <span aria-hidden="true">{acceso.icono}</span>
              {acceso.texto}
            </button>
          ))}
          <button
            type="button"
            className="chip chip--danger"
            style={{ marginLeft: 'auto' }}
            onClick={salir}
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {datosGuardados && (
        <div className="panel panel--ok" style={{ marginTop: 14 }}>
          ✓ Cambios guardados exitosamente.
        </div>
      )}

      <div className="card card--left">
        <h3 style={{ marginBottom: 14 }}>Datos personales</h3>
        <form onSubmit={guardarDatos}>
          <Stack gap={14}>
            <div className="grid-2">
              <TextInput
                label="Nombre"
                value={datos.nombre}
                onChange={(event) =>
                  setDatos((prev) => ({
                    ...prev,
                    nombre: event.currentTarget.value,
                  }))
                }
              />
              <TextInput
                label="Apellido"
                value={datos.apellido}
                onChange={(event) =>
                  setDatos((prev) => ({
                    ...prev,
                    apellido: event.currentTarget.value,
                  }))
                }
              />
            </div>

            <TextInput
              label="Teléfono"
              value={datos.telefono}
              onChange={(event) =>
                setDatos((prev) => ({
                  ...prev,
                  telefono: event.currentTarget.value,
                }))
              }
            />

            <div className="grid-3">
              <TextInput label="Correo electrónico" value={perfil.email} disabled />
              <TextInput label="DNI" value={perfil.dni} disabled />
              <TextInput
                label="Fecha de nacimiento"
                value={formatearFecha(perfil.fechaNacimiento)}
                disabled
              />
            </div>

            <div>
              <Button type="submit" loading={guardandoDatos}>
                Guardar cambios
              </Button>
            </div>
          </Stack>
        </form>
      </div>

      {esCliente && (
        <div className="card card--left">
          <div className="row" style={{ marginBottom: 4 }}>
            <h3>Mis direcciones de referencia</h3>
            <button
              type="button"
              className="chip"
              onClick={formAbierto ? () => setFormAbierto(false) : abrirNuevaDireccion}
            >
              {formAbierto ? 'Cancelar' : '+ Agregar dirección'}
            </button>
          </div>
          <p className="help" style={{ marginBottom: 12 }}>
            La dirección predeterminada se usa como origen para calcular la
            cercanía de los comercios.
          </p>

          {formAbierto && (
            <form
              onSubmit={guardarDireccion}
              className="panel"
              style={{ marginBottom: 14 }}
            >
              <Stack gap={12}>
                <div className="grid-2">
                  <TextInput
                    label="Etiqueta"
                    placeholder="Casa, Trabajo…"
                    value={formDireccion.etiqueta}
                    onChange={campoDireccion('etiqueta')}
                  />
                  <TextInput
                    label="Localidad"
                    value={formDireccion.localidad}
                    onChange={campoDireccion('localidad')}
                  />
                </div>

                <div className="grid-2">
                  <TextInput
                    label="Calle"
                    value={formDireccion.calle}
                    onChange={campoDireccion('calle')}
                  />
                  <div className="grid-2">
                    <TextInput
                      label="Número"
                      value={formDireccion.numero}
                      onChange={campoDireccion('numero')}
                    />
                    <TextInput
                      label="Piso"
                      placeholder="Opcional"
                      value={formDireccion.piso}
                      onChange={campoDireccion('piso')}
                    />
                  </div>
                </div>

                <TextInput
                  label="Descripción"
                  placeholder="Entre calles, referencia… (opcional)"
                  value={formDireccion.descripcion}
                  onChange={campoDireccion('descripcion')}
                />

                <BuscadorDireccion
                  token={token}
                  onSeleccion={(sugerencia) =>
                    setFormDireccion((prev) => ({
                      ...prev,
                      calle: sugerencia.calle || prev.calle,
                      numero: sugerencia.numero || prev.numero,
                      localidad: sugerencia.localidad || prev.localidad,
                      latitud: sugerencia.latitud.toFixed(6),
                      longitud: sugerencia.longitud.toFixed(6),
                    }))
                  }
                />

                <MapaUbicacion
                  latitud={latitudMapa}
                  longitud={longitudMapa}
                  onChange={(latitud, longitud) =>
                    setFormDireccion((prev) => ({
                      ...prev,
                      latitud: latitud.toFixed(6),
                      longitud: longitud.toFixed(6),
                    }))
                  }
                />

                <div className="row">
                  <button
                    type="button"
                    className="chip"
                    onClick={usarUbicacion}
                    disabled={ubicando}
                  >
                    {ubicando ? 'Ubicando…' : '📍 Usar mi ubicación'}
                  </button>
                  <span className="help">
                    Arrastrá el pin o tocá el mapa para ajustar la ubicación.
                  </span>
                </div>

                <div className="grid-2">
                  <TextInput
                    label="Latitud"
                    value={formDireccion.latitud}
                    onChange={campoDireccion('latitud')}
                  />
                  <TextInput
                    label="Longitud"
                    value={formDireccion.longitud}
                    onChange={campoDireccion('longitud')}
                  />
                </div>

                <Group justify="flex-end">
                  <Button
                    type="submit"
                    loading={guardandoDireccion}
                    styles={{
                      root: {
                        backgroundColor: 'var(--mint)',
                        color: 'var(--mint-tx)',
                      },
                    }}
                  >
                    Guardar dirección
                  </Button>
                </Group>

                {errorDireccion && (
                  <p
                    style={{ color: 'var(--bad)', fontSize: 12 }}
                    role="alert"
                  >
                    {errorDireccion}
                  </p>
                )}
              </Stack>
            </form>
          )}

          {perfil.direcciones.length === 0 ? (
            <p className="muted">Todavía no cargaste direcciones.</p>
          ) : (
            <div>
              {perfil.direcciones.map((direccion) => (
                <div key={direccion.id} className="address-row">
                  <div>
                    <strong>{direccion.etiqueta}</strong>{' '}
                    <span className="muted">
                      ({direccion.calle} {direccion.numero}
                      {direccion.piso ? `, piso ${direccion.piso}` : ''},{' '}
                      {direccion.localidad})
                    </span>
                    {direccion.esPredeterminada && (
                      <span className="badge badge--ok" style={{ marginLeft: 8 }}>
                        Predeterminada
                      </span>
                    )}
                  </div>
                  <div className="address-row__actions">
                    <button
                      type="button"
                      className="chip"
                      onClick={() => editarDireccion(direccion)}
                    >
                      Editar
                    </button>
                    {!direccion.esPredeterminada && (
                      <>
                        <button
                          type="button"
                          className="chip"
                          onClick={() => hacerPredeterminada(direccion.id)}
                        >
                          Hacer predeterminada
                        </button>
                        <button
                          type="button"
                          className="chip chip--danger"
                          onClick={() => setEliminarId(direccion.id)}
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card card--left">
        <h3>Seguridad</h3>
        <p className="muted" style={{ margin: '4px 0 14px' }}>
          Podés cambiar tu contraseña desde el flujo seguro de recuperación.
        </p>
        <Button variant="default" onClick={solicitarCambioPassword}>
          Cambiar contraseña
        </Button>
      </div>

      <div className="card card--left danger-card">
        <h3>Zona de peligro</h3>
        <p className="muted" style={{ margin: '4px 0 14px' }}>
          Si solicitás la eliminación de tu cuenta, el equipo de soporte
          revisará el pedido. La baja se concreta cuando es aprobada.
        </p>

        {bajaPendiente || bajaEnviada ? (
          <div className="panel panel--warn">
            Tu solicitud de baja está pendiente de revisión administrativa. Te
            avisaremos cuando sea resuelta.
          </div>
        ) : (
          <button
            type="button"
            className="chip chip--danger"
            onClick={() => setBajaAbierta(true)}
          >
            Solicitar eliminación de cuenta
          </button>
        )}
      </div>

      <Modal
        opened={bajaAbierta}
        onClose={() => setBajaAbierta(false)}
        title="Solicitar baja de cuenta"
        centered
        radius="lg"
      >
        <form onSubmit={enviarBaja}>
          <Stack gap={12}>
            <p className="muted">
              Tu pedido quedará en revisión administrativa antes de concretarse.
              Te recomendamos revisar tus pedidos y reclamos pendientes.
            </p>
            <Select
              label="Motivo"
              placeholder="Elegí un motivo"
              data={MOTIVOS_BAJA}
              value={motivo}
              onChange={setMotivo}
            />
            <PasswordInput
              label="Contraseña actual"
              placeholder="🔒 Confirmá tu contraseña"
              value={passwordBaja}
              onChange={(event) => setPasswordBaja(event.currentTarget.value)}
            />
            {errorBaja && (
              <p style={{ color: 'var(--bad)', fontSize: 12 }} role="alert">
                {errorBaja}
              </p>
            )}
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setBajaAbierta(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                loading={enviandoBaja}
                styles={{
                  root: {
                    backgroundColor: 'var(--bad)',
                    color: '#fff',
                  },
                }}
              >
                Enviar solicitud formal
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={eliminarId !== null}
        onClose={() => setEliminarId(null)}
        title="Eliminar dirección"
        centered
        radius="lg"
      >
        <p className="muted">
          ¿Querés eliminar esta dirección de referencia? Esta acción no se puede
          deshacer.
        </p>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setEliminarId(null)}>
            Cancelar
          </Button>
          <Button
            onClick={confirmarEliminar}
            loading={eliminando}
            styles={{ root: { backgroundColor: 'var(--bad)', color: '#fff' } }}
          >
            Eliminar
          </Button>
        </Group>
      </Modal>
    </PageShell>
  );
}
