import { Link, NavLink } from 'react-router-dom';
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
          <nav
            className="topbar__nav"
            aria-label="Navegación principal del comerciante"
          >
            {usuario.rol === 'CLIENTE' && (
              <NavLink
                to="/buscar"
                className={({ isActive }) =>
                  `pill${isActive ? ' pill--active' : ''}`
                }
              >
                Explorar ofertas
              </NavLink>
            )}
            {usuario.rol === 'COMERCIANTE' && (
              <>
                <NavLink
                  to="/ofertas/mias"
                  end
                  className={({ isActive }) =>
                    `pill${isActive ? ' pill--active' : ''}`
                  }
                >
                  Ofertas
                </NavLink>

                <NavLink
                  to="/comercios/perfil"
                  end
                  className={({ isActive }) =>
                    `pill${isActive ? ' pill--active' : ''}`
                  }
                >
                  Mi local
                </NavLink>

                <NavLink
                  to="/comercios/horarios"
                  end
                  className={({ isActive }) =>
                    `pill${isActive ? ' pill--active' : ''}`
                  }
                >
                  Horarios
                </NavLink>

                <NavLink
                  to="/panel/reputacion"
                  className={({ isActive }) =>
                    `pill${isActive ? ' pill--active' : ''}`
                  }
                >
                  Reputación
                </NavLink>
              </>
            )}

            <Link to="/perfil" className="pill">
              <span aria-hidden="true">👤</span>
              {usuario.nombre}
              <span aria-hidden="true">⌄</span>
            </Link>
          </nav>
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
