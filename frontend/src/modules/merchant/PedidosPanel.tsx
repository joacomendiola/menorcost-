import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';

export function PedidosPanel() {
  return (
    <main className="merchant-content">
      <div style={{ marginTop: 16 }}>
        <Card className="reviews-card">
          <h2 style={{ marginTop: 0 }}>Pedidos</h2>
          <p className="muted" style={{ marginBottom: 16 }}>
            Acá vas a ver los pedidos que recibe tu comercio, con su estado y la
            franja horaria de retiro. La gestión de pedidos se integra en el
            próximo módulo.
          </p>
          <Link className="ui-chip ui-chip--active" to="/panel/productos">
            Ir a mis productos
          </Link>
        </Card>
      </div>
    </main>
  );
}
