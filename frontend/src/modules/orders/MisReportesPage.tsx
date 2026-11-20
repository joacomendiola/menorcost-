import { Loader } from '@mantine/core';
import { useEffect, useState } from 'react';
import { ApiError, reportesApi, type ReporteMio } from '../../api';
import { useAuth } from '../../auth/contexto';
import { PageShell } from '../../components/PageShell';

const formatearFecha = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
});

export function MisReportesPage() {
  const { token } = useAuth();
  const [reportes, setReportes] = useState<ReporteMio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;

    let activo = true;
    void reportesApi
      .misReportes(token, { limit: 50 })
      .then((respuesta) => {
        if (activo) setReportes(respuesta.data);
      })
      .catch((reason: unknown) => {
        if (activo) {
          setError(
            reason instanceof ApiError
              ? reason.message
              : 'No pudimos cargar tus reportes.',
          );
        }
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [token]);

  return (
    <PageShell variant="profile">
      <div className="perfil-encabezado">
        <h1>Mis reportes</h1>
      </div>

      {cargando && <Loader />}
      {!cargando && error && <div className="panel">{error}</div>}
      {!cargando && !error && reportes.length === 0 && (
        <div className="card card--left">Todavía no enviaste reportes.</div>
      )}

      {!cargando &&
        !error &&
        reportes.map((reporte) => (
          <article
            className="card card--left"
            key={reporte.id_reporte}
            style={{ marginBottom: 12 }}
          >
            <div className="perfil-encabezado">
              <h3>{reporte.motivo}</h3>
              <span className="chip">
                {reporte.estado_reporte.replaceAll('_', ' ')}
              </span>
            </div>
            <p>{reporte.descripcion || 'Sin descripción.'}</p>
            <p style={{ color: 'var(--muted)' }}>
              Pedido {reporte.pedido?.codigoAlfanumerico ?? '—'} ·{' '}
              {formatearFecha.format(new Date(reporte.fecha_reporte))}
              {reporte.denunciado
                ? ` · Denunciado: ${reporte.denunciado.nombre} ${reporte.denunciado.apellido}`
                : ''}
            </p>
          </article>
        ))}
    </PageShell>
  );
}
