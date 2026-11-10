import { Link } from 'react-router-dom';
import { PageShell } from '../components/PageShell';

interface EnConstruccionProps {
  titulo: string;
  descripcion: string;
}

export function EnConstruccion({ titulo, descripcion }: EnConstruccionProps) {
  return (
    <PageShell variant="profile">
      <div className="card card--left">
        <h1 style={{ marginTop: 0 }}>{titulo}</h1>
        <p className="muted">{descripcion}</p>
        <div className="panel panel--warn" style={{ marginBottom: 16 }}>
          Esta sección estará disponible en el próximo módulo.
        </div>
        <Link className="ui-chip ui-chip--active" to="/perfil">
          Volver a mi perfil
        </Link>
      </div>
    </PageShell>
  );
}
