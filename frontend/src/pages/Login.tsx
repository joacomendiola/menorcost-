import {
  Button,
  Checkbox,
  PasswordInput,
  Stack,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api';
import { useAuth } from '../auth/contexto';
import { Logo } from '../components/Logo';
import { PageShell } from '../components/PageShell';
import { rutaInicio } from '../auth/rutaInicio';

export function Login() {
  const { iniciarSesion } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recordarme, setRecordarme] = useState(true);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (!email.includes('@') || password.length === 0) {
      setError('Correo electrónico o contraseña incorrectos');
      return;
    }

    setEnviando(true);
    try {
      const usuario = await iniciarSesion(email.trim(), password);
      notifications.show({ message: '¡Bienvenido de nuevo!' });
      navigate(rutaInicio(usuario.rol), { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'CUENTA_PENDIENTE_VERIFICACION') {
          notifications.show({ message: err.message });
          navigate('/verificar-correo', { state: { email: email.trim() } });
          return;
        }
        setError(err.message);
      } else {
        setError('Ocurrió un error inesperado. Intentá de nuevo.');
      }
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

        <h2 style={{ margin: '16px 0 4px' }}>Ingresá a MENORCOST</h2>
        <p className="muted" style={{ marginBottom: 20 }}>
          Entrá con tu email para comprar y vender alimentos próximos a vencer.
        </p>

        <form onSubmit={onSubmit} style={{ textAlign: 'left' }}>
          <Stack gap={14}>
            <Button
              variant="default"
              fullWidth
              disabled
              title="Disponible próximamente"
            >
              <span style={{ fontWeight: 800, marginRight: 8 }}>G</span>
              Continuar con Google
            </Button>

            <div className="divider-text">o con tu cuenta</div>

            <TextInput
              placeholder="✉ Email"
              aria-label="Correo electrónico"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
            />

            <PasswordInput
              placeholder="🔒 Contraseña"
              aria-label="Contraseña"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />

            {error && (
              <p style={{ color: 'var(--bad)', fontSize: 12 }} role="alert">
                {error}
              </p>
            )}

            <div className="row">
              <Checkbox
                label="Recordarme"
                size="xs"
                checked={recordarme}
                onChange={(event) => setRecordarme(event.currentTarget.checked)}
              />
              <Link to="/recuperar" style={{ fontSize: 13 }}>
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <Button type="submit" fullWidth loading={enviando}>
              Ingresar
            </Button>
          </Stack>
        </form>

        <p className="help" style={{ marginTop: 18 }}>
          ¿No tenés cuenta? <Link to="/registro">Registrate gratis</Link>
        </p>
      </div>
    </PageShell>
  );
}
