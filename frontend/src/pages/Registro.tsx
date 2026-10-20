import {
  Button,
  Checkbox,
  PasswordInput,
  Stack,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, authApi } from '../api';
import type { DireccionPayload } from '../api';
import { Logo } from '../components/Logo';
import { PageShell } from '../components/PageShell';

type TipoCuenta = 'cliente' | 'comerciante';

interface Formulario {
  nombre: string;
  apellido: string;
  dni: string;
  fechaNacimiento: string;
  telefono: string;
  email: string;
  password: string;
  repetir: string;
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

const FORMULARIO_INICIAL: Formulario = {
  nombre: '',
  apellido: '',
  dni: '',
  fechaNacimiento: '',
  telefono: '',
  email: '',
  password: '',
  repetir: '',
};

function fechaMaximaPermitida(): string {
  const limite = new Date();
  limite.setFullYear(limite.getFullYear() - 8);
  const mes = String(limite.getMonth() + 1).padStart(2, '0');
  const dia = String(limite.getDate()).padStart(2, '0');
  return `${limite.getFullYear()}-${mes}-${dia}`;
}

const FECHA_MAXIMA = fechaMaximaPermitida();

function esMayorDe8Anios(fecha: string): boolean {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  if (!anio || !mes || !dia) return false;

  const nacimiento = new Date(anio, mes - 1, dia);
  if (Number.isNaN(nacimiento.getTime())) return false;

  const hoy = new Date();
  const limite = new Date(
    hoy.getFullYear() - 8,
    hoy.getMonth(),
    hoy.getDate(),
  );

  return nacimiento <= limite;
}

const DIRECCION_INICIAL: FormularioDireccion = {
  etiqueta: '',
  calle: '',
  numero: '',
  piso: '',
  localidad: 'Ushuaia',
  descripcion: '',
  latitud: '-54.801900',
  longitud: '-68.303000',
};

export function Registro() {
  const navigate = useNavigate();

  const [tipo, setTipo] = useState<TipoCuenta>('cliente');
  const [form, setForm] = useState<Formulario>(FORMULARIO_INICIAL);
  const [direccion, setDireccion] =
    useState<FormularioDireccion>(DIRECCION_INICIAL);
  const [acepta, setAcepta] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  function campo(nombre: keyof Formulario) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const valor = event.currentTarget.value;
      setForm((prev) => ({ ...prev, [nombre]: valor }));
    };
  }

  function campoDireccion(nombre: keyof FormularioDireccion) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const valor = event.currentTarget.value;
      setDireccion((prev) => ({ ...prev, [nombre]: valor }));
    };
  }

  const hayDireccion =
    direccion.etiqueta.trim() !== '' ||
    direccion.calle.trim() !== '' ||
    direccion.numero.trim() !== '' ||
    direccion.piso.trim() !== '' ||
    direccion.descripcion.trim() !== '';

  function construirDireccion(): DireccionPayload | null {
    if (!hayDireccion) return null;
    return {
      etiqueta: direccion.etiqueta.trim(),
      calle: direccion.calle.trim(),
      numero: direccion.numero.trim(),
      piso: direccion.piso.trim() || undefined,
      localidad: direccion.localidad.trim(),
      descripcion: direccion.descripcion.trim() || undefined,
      latitud: Number(direccion.latitud),
      longitud: Number(direccion.longitud),
    };
  }

  function validar(): string {
    if (form.nombre.trim().length < 2) return 'Ingresá tu nombre';
    if (form.apellido.trim().length < 2) return 'Ingresá tu apellido';
    if (!/^\d{7,8}$/.test(form.dni)) return 'El DNI debe tener 7 u 8 dígitos';
    if (!form.fechaNacimiento) return 'Ingresá tu fecha de nacimiento';
    if (!esMayorDe8Anios(form.fechaNacimiento))
      return 'Debés ser mayor de 8 años para registrarte';
    if (!/^[0-9+\-\s]{6,20}$/.test(form.telefono))
      return 'Ingresá un teléfono válido';
    if (!form.email.includes('@')) return 'Ingresá un correo electrónico válido';
    if (form.password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
    if (form.password !== form.repetir) return 'Las contraseñas no coinciden';
    if (!acepta) return 'Tenés que aceptar los términos y condiciones';

    if (hayDireccion) {
      if (!direccion.etiqueta.trim()) return 'Ingresá una etiqueta para la dirección';
      if (!direccion.calle.trim() || !direccion.numero.trim())
        return 'Completá la calle y el número de la dirección';
      if (!direccion.localidad.trim()) return 'Ingresá la localidad de la dirección';
      const lat = Number(direccion.latitud);
      const lng = Number(direccion.longitud);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90)
        return 'La latitud de la dirección no es válida';
      if (!Number.isFinite(lng) || lng < -180 || lng > 180)
        return 'La longitud de la dirección no es válida';
    }

    return '';
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const mensaje = validar();
    setError(mensaje);
    if (mensaje) return;

    setEnviando(true);
    try {
      const direccionPayload = construirDireccion();

      await authApi.registro({
        dni: form.dni,
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        fechaNacimiento: form.fechaNacimiento,
        telefono: form.telefono,
        email: form.email.trim().toLowerCase(),
        password: form.password,
        ...(direccionPayload ? { direccion: direccionPayload } : {}),
      });

      notifications.show({
        message: 'Cuenta creada con éxito. Revisá tu correo electrónico.',
      });
      navigate('/verificar-correo', {
        state: { email: form.email.trim().toLowerCase() },
      });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No pudimos crear la cuenta. Intentá de nuevo.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <PageShell>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Logo size={30} />
        </div>

        <h2 style={{ margin: '16px 0 4px' }}>Creá tu cuenta</h2>
        <p className="muted" style={{ marginBottom: 20 }}>
          Sumate para comprar y vender alimentos próximos a vencer.
        </p>

        <div className="type-selector" style={{ marginBottom: 18 }}>
          <button
            type="button"
            className={`type-option ${tipo === 'cliente' ? 'type-option--active' : ''}`}
            onClick={() => setTipo('cliente')}
          >
            👤 Soy cliente
          </button>
          <button
            type="button"
            className={`type-option ${tipo === 'comerciante' ? 'type-option--active' : ''}`}
            onClick={() => setTipo('comerciante')}
          >
            🏪 Soy comerciante
          </button>
        </div>

        {tipo === 'comerciante' && (
          <div className="panel panel--warn" style={{ marginBottom: 18 }}>
            El alta comercial (CUIT, rubro y georreferenciación del local) se
            completa en el <strong>Módulo 2</strong>. Por ahora podés crear tu
            cuenta como cliente y continuar el registro del comercio más
            adelante.
          </div>
        )}

        <form onSubmit={onSubmit} style={{ textAlign: 'left' }}>
          <Stack gap={14}>
            <Button
              variant="default"
              fullWidth
              disabled
              title="Disponible próximamente"
            >
              <span style={{ fontWeight: 800, marginRight: 8 }}>G</span>
              Registrarte con Google
            </Button>

            <div className="divider-text">o creá tu cuenta</div>

            <div className="grid-2">
              <TextInput
                placeholder="👤 Nombre"
                aria-label="Nombre"
                value={form.nombre}
                onChange={campo('nombre')}
              />
              <TextInput
                placeholder="👤 Apellido"
                aria-label="Apellido"
                value={form.apellido}
                onChange={campo('apellido')}
              />
            </div>

            <div className="grid-2">
              <TextInput
                placeholder="🪪 DNI"
                aria-label="DNI"
                inputMode="numeric"
                maxLength={8}
                value={form.dni}
                onChange={campo('dni')}
              />
              <TextInput
                type="date"
                aria-label="Fecha de nacimiento"
                max={FECHA_MAXIMA}
                value={form.fechaNacimiento}
                onChange={campo('fechaNacimiento')}
              />
            </div>

            <TextInput
              placeholder="📱 Teléfono"
              aria-label="Teléfono"
              value={form.telefono}
              onChange={campo('telefono')}
            />

            <TextInput
              placeholder="✉ Email"
              aria-label="Correo electrónico"
              autoComplete="email"
              value={form.email}
              onChange={campo('email')}
            />

            <PasswordInput
              placeholder="🔒 Contraseña"
              aria-label="Contraseña"
              autoComplete="new-password"
              value={form.password}
              onChange={campo('password')}
            />

            <PasswordInput
              placeholder="🔒 Repetir contraseña"
              aria-label="Repetir contraseña"
              autoComplete="new-password"
              value={form.repetir}
              onChange={campo('repetir')}
            />

            <div className="divider-text" style={{ marginTop: 4 }}>
              Dirección de referencia (opcional)
            </div>

            <div className="grid-2">
              <TextInput
                label="Etiqueta"
                placeholder="Casa, Trabajo…"
                value={direccion.etiqueta}
                onChange={campoDireccion('etiqueta')}
              />
              <TextInput
                label="Localidad"
                value={direccion.localidad}
                onChange={campoDireccion('localidad')}
              />
            </div>

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
                  label="Piso"
                  placeholder="Opcional"
                  value={direccion.piso}
                  onChange={campoDireccion('piso')}
                />
              </div>
            </div>

            <div className="grid-2">
              <TextInput
                label="Latitud"
                value={direccion.latitud}
                onChange={campoDireccion('latitud')}
              />
              <TextInput
                label="Longitud"
                value={direccion.longitud}
                onChange={campoDireccion('longitud')}
              />
            </div>

            <Checkbox
              size="xs"
              checked={acepta}
              onChange={(event) => setAcepta(event.currentTarget.checked)}
              label={
                <span>
                  Acepto los{' '}
                  <span style={{ color: 'var(--pri)' }}>
                    Términos y Condiciones
                  </span>{' '}
                  y la{' '}
                  <span style={{ color: 'var(--pri)' }}>
                    Política de Privacidad
                  </span>
                </span>
              }
            />

            {error && (
              <p style={{ color: 'var(--bad)', fontSize: 12 }} role="alert">
                {error}
              </p>
            )}

            <Button type="submit" fullWidth loading={enviando} disabled={!acepta}>
              {tipo === 'comerciante'
                ? 'Crear cuenta y continuar'
                : 'Crear cuenta'}
            </Button>
          </Stack>
        </form>

        <p className="help" style={{ marginTop: 18 }}>
          ¿Ya tenés cuenta? <Link to="/login">Ingresar</Link>
        </p>
      </div>
    </PageShell>
  );
}
