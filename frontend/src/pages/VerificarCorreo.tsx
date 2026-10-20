import { Button, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, authApi } from '../api';
import { useAuth } from '../auth/contexto';
import { PageShell } from '../components/PageShell';

export function VerificarCorreo() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { registrarSesion } = useAuth();
  const otpRef = useRef<HTMLInputElement>(null);

  const estado = location.state as { email?: string } | null;
  const email = estado?.email ?? params.get('email') ?? '';

  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [reenviando, setReenviando] = useState(false);

  function onCambioCodigo(event: ChangeEvent<HTMLInputElement>) {
    const soloDigitos = event.currentTarget.value.replace(/\D/g, '').slice(0, 6);
    setCodigo(soloDigitos);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (codigo.length !== 6) {
      setError('Ingresá los 6 dígitos');
      return;
    }

    setEnviando(true);
    try {
      const data = await authApi.verificarCuenta(email, codigo);
      registrarSesion(data.accessToken, data.usuario);
      notifications.show({ message: 'Cuenta verificada. ¡Bienvenido!' });
      navigate('/perfil', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No pudimos verificar la cuenta. Intentá de nuevo.',
      );
      setCodigo('');
      otpRef.current?.focus();
    } finally {
      setEnviando(false);
    }
  }

  async function reenviar() {
    setReenviando(true);
    setError('');
    try {
      await authApi.reenviarCodigo(email);
      notifications.show({ message: 'Código reenviado' });
      otpRef.current?.focus();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No pudimos reenviar el código.',
      );
    } finally {
      setReenviando(false);
    }
  }

  if (!email) {
    return (
      <PageShell>
        <div className="card">
          <h2>Verificá tu correo</h2>
          <p className="muted" style={{ margin: '6px 0 18px' }}>
            No encontramos el correo a verificar.
          </p>
          <div className="panel panel--warn">
            Volvé a crear tu cuenta para recibir un nuevo código de
            verificación.
          </div>
          <Button
            fullWidth
            style={{ marginTop: 18 }}
            onClick={() => navigate('/registro')}
          >
            Ir a crear cuenta
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="card">
        <div style={{ fontSize: 40 }} aria-hidden="true">
          📧
        </div>
        <h2 style={{ margin: '8px 0 4px' }}>Verificá tu correo</h2>
        <p className="muted" style={{ marginBottom: 20 }}>
          Enviamos un código de 6 dígitos a <strong>{email}</strong>. Vence en 10
          minutos.
        </p>

        <form onSubmit={onSubmit}>
          <Stack gap={14}>
            <input
              ref={otpRef}
              className="otp-input"
              aria-label="Código de verificación de 6 dígitos"
              placeholder="······"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={codigo}
              onChange={onCambioCodigo}
              autoFocus
            />

            {error && (
              <p style={{ color: 'var(--bad)', fontSize: 12 }} role="alert">
                {error}
              </p>
            )}

            <Button type="submit" fullWidth loading={enviando}>
              Verificar cuenta
            </Button>

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                className="chip"
                onClick={reenviar}
                disabled={reenviando}
              >
                {reenviando ? 'Reenviando…' : 'Reenviar código'}
              </button>
              <Link to="/registro" className="chip">
                Cambiar correo
              </Link>
            </div>
          </Stack>
        </form>

        <p className="help" style={{ marginTop: 16 }}>
          En desarrollo, el código se imprime en la consola del backend.
        </p>
      </div>
    </PageShell>
  );
}
