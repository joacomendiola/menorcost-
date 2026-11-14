import { Button, TextInput } from '@mantine/core';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/contexto';
import { Logo } from '../components/Logo';

interface EncabezadoClienteProps {
  busqueda: string;
  direccionLabel: string;
  placeholder?: string;
  disabledBuscar?: boolean;
  onCambioBusqueda: (valor: string) => void;
  onBuscar: (event: FormEvent<HTMLFormElement>) => void;
}

export function EncabezadoCliente({
  busqueda,
  direccionLabel,
  placeholder = 'Buscar locales',
  disabledBuscar = false,
  onCambioBusqueda,
  onBuscar,
}: EncabezadoClienteProps) {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="inicio-cliente__top">
      <Link to="/inicio" aria-label="Ir al inicio de Menorcost">
        <Logo />
      </Link>

      <button
        type="button"
        className="inicio-cliente__direccion"
        onClick={() => navigate('/perfil')}
      >
        <span>Enviar a</span>
        <strong>{direccionLabel} ✎</strong>
      </button>

      <form className="inicio-cliente__search" onSubmit={onBuscar}>
        <TextInput
          aria-label={placeholder}
          placeholder={placeholder}
          value={busqueda}
          onChange={(event) => onCambioBusqueda(event.currentTarget.value)}
        />
        <Button type="submit" aria-label="Buscar" disabled={disabledBuscar}>
          🔍
        </Button>
      </form>

      <nav className="inicio-cliente__actions" aria-label="Acciones de cliente">
        <Link className="pill" to="/canastas">
          <span aria-hidden="true">🧺</span>
          Mis canastas
        </Link>
        <Link className="pill" to="/perfil">
          <span aria-hidden="true">👤</span>
          {usuario?.nombre ?? 'Mi perfil'}
        </Link>
      </nav>
    </header>
  );
}
