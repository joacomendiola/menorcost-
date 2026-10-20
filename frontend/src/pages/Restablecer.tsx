import { Button, PasswordInput, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, authApi } from '../api';
import { PageShell } from '../components/PageShell';

export function Restablecer() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');

  const [password, setPassword] = useState('');
  const [repetir, setRepetir] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Mínimo 8 caracteres');
      return;
    }

    if (password !== repetir) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (!token) return;

    setEnviando(true);
    try {
      await authApi.restablecerPassword(token, password);
      notifications.show({
        message: 'Contraseña actualizada. Ya podés ingresar.',
      });
      navigate('/login', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No pudimos restablecer la contraseña. Intentá de nuevo.',
      );
    } finally {
      setEnviando(false);
    }
  }

  if (!token) {
    return (
      <PageShell>
        <div className="card">
          <h2>Nueva contraseña</h2>
          <p className="muted" style={{ margin: '6px 0 18px' }}>
            Este enlace no es válido o está incompleto.
          </p>
          <div className="panel panel--warn">
            El enlace de restablecimiento caducó o no contiene un token válido.
            Solicitá uno nuevo.
          </div>
          <Button
            fullWidth
            style={{ marginTop: 18 }}
            onClick={() => navigate('/recuperar')}
          >
            Solicitar otro enlace
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="card">
        <h2>Nueva contraseña</h2>
        <p className="muted" style={{ margin: '4px 0 20px' }}>
          Enlace válido por 15 minutos. La contraseña debe tener al menos 8
          caracteres.
        </p>

        <form onSubmit={onSubmit} style={{ textAlign: 'left' }}>
          <Stack gap={14}>
            <PasswordInput
              placeholder="🔒 Nueva contraseña"
              aria-label="Nueva contraseña"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />

            <PasswordInput
              placeholder="🔒 Repetir contraseña"
              aria-label="Repetir contraseña"
              autoComplete="new-password"
              value={repetir}
              onChange={(event) => setRepetir(event.currentTarget.value)}
            />

            {error && (
              <p style={{ color: 'var(--bad)', fontSize: 12 }} role="alert">
                {error}
              </p>
            )}

            <Button type="submit" fullWidth loading={enviando}>
              Restablecer contraseña
            </Button>
          </Stack>
        </form>
      </div>
    </PageShell>
  );
}
