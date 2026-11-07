import { useEffect, useState, useCallback } from 'react';
import { Center, Loader, Title, Text, Divider, Stack, Button } from '@mantine/core';
import { useAuth } from '../../auth/contexto';
import { reputacionApi, type ReputacionComercio, type Calificacion } from '../../api';
import { MerchantHeader } from '../../components/layout/MerchantHeader';
import { Card } from '../../components/ui/Card';

const STAR_FILLED = '★';
const STAR_COLOR = '#F59E0B';
const STAR_EMPTY_COLOR = '#CBD5E1';

function formatearPuntaje(valor: number): string {
  return valor.toLocaleString('es-AR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function StarsDisplay({ puntaje, size = 20 }: { puntaje: number; size?: number }) {
  return (
    <span
      role="img"
      aria-label={`${puntaje} de 5 estrellas`}
      style={{ display: 'inline-flex', gap: '2px', lineHeight: 1 }}
    >
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          style={{
            fontSize: size,
            color: n <= puntaje ? STAR_COLOR : STAR_EMPTY_COLOR,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          {STAR_FILLED}
        </span>
      ))}
    </span>
  );
}

function ResenaItem({ resena }: { resena: Calificacion }) {
  return (
    <article className="resena-item" style={{ border: '1px solid var(--bd)', borderRadius: '16px', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <Text fw={600} size="md">{resena.clienteNombre}</Text>
        <Text c="dimmed" size="sm">{new Date(resena.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}</Text>
      </div>
      <StarsDisplay puntaje={resena.puntaje} size={18} />
      {resena.comentario && (
        <Text mt="8px" size="sm" style={{ color: 'var(--tx)', whiteSpace: 'pre-line' }}>
          {resena.comentario}
        </Text>
      )}
    </article>
  );
}

function DistribucionBarras({ distribucion, total }: { distribucion: Record<string, number>; total: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {[5, 4, 3, 2, 1].map(n => {
        const count = distribucion[n.toString()] ?? 0;
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <span style={{ width: '24px', textAlign: 'right', color: STAR_COLOR, fontWeight: 700 }}>
              {n}★
            </span>
            <div style={{ flex: 1, height: '8px', background: 'var(--soft)', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: 'var(--pri)',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <span style={{ width: '36px', textAlign: 'right', color: 'var(--mut)' }}>{count}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Reviews() {
  const { token } = useAuth();
  const [data, setData] = useState<ReputacionComercio | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarMas = useCallback(async (cursor: number) => {
    if (!token) return;
    try {
      setCargandoMas(true);
      setError(null);
      const resp = await reputacionApi.obtenerMiReputacion(token, { limit: 10, cursor });
      setData(prev => {
        if (prev) {
          return {
            ...resp,
            resenas: [...prev.resenas, ...resp.resenas],
          };
        }
        return resp;
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar reputación');
    } finally {
      setCargandoMas(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let activa = true;

    const cargarInicial = async () => {
      try {
        const resp = await reputacionApi.obtenerMiReputacion(token, { limit: 10 });
        if (activa) setData(resp);
      } catch (e: unknown) {
        if (activa) setError(e instanceof Error ? e.message : 'Error al cargar reputación');
      } finally {
        if (activa) setCargando(false);
      }
    };

    void cargarInicial();
    return () => {
      activa = false;
    };
  }, [token]);

  if (!token) {
    return (
      <>
        <MerchantHeader />
        <Center mih="50vh">
          <Text c="red" fw={600}>No hay una sesión activa. Iniciá sesión nuevamente.</Text>
        </Center>
      </>
    );
  }

  if (cargando) {
    return (
      <>
        <MerchantHeader />
        <Center mih="50vh"><Loader color="brand" /></Center>
      </>
    );
  }

  if (error && !data) {
    return (
      <>
        <MerchantHeader />
        <Center mih="50vh">
          <Text c="red" fw={600}>{error}</Text>
        </Center>
      </>
    );
  }

  if (!data) return null;

  const { promedio, totalResenas, distribucion, resenas, paginacion } = data;

  return (
    <>
      <MerchantHeader />

      <main className="merchant-content">
        <div className="reviews-grid" style={{ marginTop: '16px' }}>
          {/* Columna izquierda: Reseñas */}
          <section>
            <Card className="reviews-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <Title order={3} size="md">Reseñas de clientes</Title>
                {paginacion.hasMore && (
                  <Button
                    variant="subtle"
                    size="sm"
                    onClick={() => paginacion.nextCursor !== null && cargarMas(paginacion.nextCursor)}
                    disabled={cargandoMas}
                    loading={cargandoMas}
                    loaderProps={{ size: 'sm' }}
                  >
                    Ver más
                  </Button>
                )}
              </div>

              {error && (
                <Text c="red" size="sm" mb="8px">
                  {error}
                </Text>
              )}
              {resenas.length === 0 ? (
                <Center py="xl">
                  <Text c="dimmed">Este comercio aún no tiene reseñas.</Text>
                </Center>
              ) : (
                <Stack gap="12px">
                  {resenas.map(r => (
                    <ResenaItem key={r.id} resena={r} />
                  ))}
                </Stack>
              )}
            </Card>
          </section>

          {/* Columna derecha: Reputación */}
          <section>
            <Card className="reputacion-card">
              <Title order={3} size="md" style={{ marginBottom: '16px' }}>Reputación</Title>

              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '30px', fontWeight: 800, color: 'var(--tx)', lineHeight: 1 }}>
                  ★ {formatearPuntaje(promedio)}
                </div>
                <Text c="dimmed" size="sm" mt="6px">
                  {totalResenas} reseña{totalResenas !== 1 ? 's' : ''} verificada
                  {totalResenas !== 1 ? 's' : ''} (solo pedidos ENTREGADOS)
                </Text>
              </div>

              <Divider my="md" />
              <DistribucionBarras distribucion={distribucion} total={totalResenas} />
            </Card>
          </section>
        </div>
      </main>
    </>
  );
}