import { Button, TextInput } from '@mantine/core';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, authApi } from '../api';
import { PageShell } from '../components/PageShell';

export function Recuperar() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (!email.includes('@')) {
      setError('Ingresá un correo electrónico válido');
      return;
    }

    setEnviando(true);
    try {
      await authApi.olvidarPassword(email.trim());
      setEnviado(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No pudimos enviar el enlace. Intentá de nuevo.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <PageShell variant="auth-left">
      <Link to="/login" className="chip">
        ← Volver al ingreso
      </Link>

      <div className="card card--left">
        <h2>Recuperación de contraseña</h2>
        <p className="muted" style={{ margin: '4px 0 18px' }}>
          Te enviaremos un enlace seguro para definir una nueva contraseña. El
          enlace tiene una validez de 15 minutos.
        </p>

        {!enviado ? (
          <form onSubmit={onSubmit}>
            <TextInput
              label="Correo electrónico"
              placeholder="✉ tu@email.com"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
            />

            {error && (
              <p
                style={{ color: 'var(--bad)', fontSize: 12, marginTop: 10 }}
                role="alert"
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              fullWidth
              loading={enviando}
              style={{ marginTop: 16 }}
            >
              Enviar enlace de restablecimiento
            </Button>
          </form>
        ) : (
          <>
            <div className="panel panel--ok">
              Si el correo ingresado se encuentra registrado, recibirás un
              mensaje con las instrucciones para restablecer tu contraseña.
            </div>
            <p className="help" style={{ marginTop: 14 }}>
              En desarrollo, el enlace se imprime en la consola del backend.
            </p>
            <Button
              fullWidth
              variant="default"
              style={{ marginTop: 16 }}
              onClick={() => navigate('/login')}
            >
              Volver al ingreso
            </Button>
          </>
        )}
      </div>
    </PageShell>
  );
}
