import { Link } from 'react-router-dom';
import { useAuth } from '../auth/contexto';
import { Logo } from './Logo';

export function TopBar() {
  const { usuario, cargando } = useAuth();

  return (
    <header className="topbar">
      <Link to="/" aria-label="Ir al inicio de Menorcost">
        <Logo />
      </Link>

      {!cargando &&
        (usuario ? (
          <Link to="/perfil" className="pill">
            <span aria-hidden="true">👤</span>
            {usuario.nombre}
            <span aria-hidden="true">⌄</span>
          </Link>
        ) : (
          <Link to="/login" className="pill">
            <span aria-hidden="true">👤</span>
            Mi perfil
            <span aria-hidden="true">⌄</span>
          </Link>
        ))}
    </header>
  );
}
