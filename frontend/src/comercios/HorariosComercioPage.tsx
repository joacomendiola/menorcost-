import { Button, Group, Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../api';
import { useAuth } from '../auth/contexto';
import { HorariosEditor } from './HorariosEditor';
import { comerciosApi, type FranjaPayload, type HorarioPayload } from './api';
import { validarConfiguracion } from './configuracion';
import './comercios.css';

function mensajeError(error: unknown, respaldo: string): string {
  return error instanceof ApiError ? error.message : respaldo;
}

export function HorariosComercioPage() {
  const navigate = useNavigate();
  const { token, cerrarSesion } = useAuth();

  const [nombre, setNombre] = useState('');
  const [horarios, setHorarios] = useState<HorarioPayload[]>([]);
  const [franjas, setFranjas] = useState<FranjaPayload[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [recargar, setRecargar] = useState(0);

  useEffect(() => {
    if (!token) return;

    let activo = true;

    async function cargar() {
      try {
        const comercio = await comerciosApi.mio(token!);
        if (!activo) return;

        if (!comercio) {
          navigate('/comercios/registro', { replace: true });
          return;
        }

        setNombre(comercio.nombreFantasia);
        setHorarios(
          comercio.horarios.map((horario) => ({
            diaSemana: horario.diaSemana,
            horaInicio: horario.horaInicio,
            horaFin: horario.horaFin,
          })),
        );
        setFranjas(
          comercio.franjas.map((franja) => ({
            diaSemana: franja.diaSemana,
            horaInicio: franja.horaInicio,
            horaFin: franja.horaFin,
            activa: franja.activa,
          })),
        );
        setErrorCarga('');
      } catch (err) {
        if (!activo) return;
        if (err instanceof ApiError && err.status === 401) {
          cerrarSesion();
          navigate('/login', { replace: true });
          return;
        }
        setErrorCarga(
          mensajeError(err, 'No pudimos cargar la configuración horaria.'),
        );
      } finally {
        if (activo) setCargando(false);
      }
    }

    void cargar();

    return () => {
      activo = false;
    };
  }, [token, cerrarSesion, navigate, recargar]);

  async function guardar() {
    if (!token) return;

    const errorConfiguracion = validarConfiguracion(horarios, franjas);
    if (errorConfiguracion) {
      setError(errorConfiguracion);
      return;
    }

    setGuardando(true);
    setError('');

    try {
      const resultado = await comerciosApi.guardarConfiguracionHoraria(token, {
        horarios,
        franjas,
      });

      setHorarios(
        resultado.horarios.map((horario) => ({
          diaSemana: horario.diaSemana,
          horaInicio: horario.horaInicio,
          horaFin: horario.horaFin,
        })),
      );
      setFranjas(
        resultado.franjas.map((franja) => ({
          diaSemana: franja.diaSemana,
          horaInicio: franja.horaInicio,
          horaFin: franja.horaFin,
          activa: franja.activa,
        })),
      );

      notifications.show({
        color: 'green',
        message: 'Horarios y franjas guardados exitosamente.',
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        cerrarSesion();
        navigate('/login', { replace: true });
        return;
      }
      setError(
        mensajeError(err, 'No pudimos guardar la configuración horaria.'),
      );
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <main className="comercio-page">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader color="brand" />
        </div>
      </main>
    );
  }

  if (errorCarga) {
    return (
      <main className="comercio-page">
        <div className="card">
          <div className="panel panel--bad">{errorCarga}</div>
          <Button
            fullWidth
            mt="md"
            onClick={() => {
              setCargando(true);
              setRecargar((prev) => prev + 1);
            }}
          >
            Reintentar
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="comercio-page">
      <button type="button" className="chip" onClick={() => navigate(-1)}>
        ← Volver
      </button>

      <h1 style={{ margin: '14px 0 4px' }}>Horarios de {nombre}</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Definí los horarios de atención y las franjas en las que tus clientes
        pueden retirar pedidos.
      </p>

      {error && (
        <div
          className="panel panel--bad"
          style={{ marginBottom: 14 }}
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="card">
        <HorariosEditor
          horarios={horarios}
          franjas={franjas}
          onChange={(nuevosHorarios, nuevasFranjas) => {
            setHorarios(nuevosHorarios);
            setFranjas(nuevasFranjas);
            setError('');
          }}
          disabled={guardando}
        />
      </div>

      <div className="comercio-acciones">
        <span className="muted">
          Los cambios se aplican juntos para evitar inconsistencias entre
          horarios y franjas.
        </span>
        <Group>
          <Button
            variant="default"
            onClick={() => navigate('/comercios/perfil')}
            disabled={guardando}
          >
            Cancelar
          </Button>
          <Button onClick={() => void guardar()} loading={guardando}>
            Guardar configuración
          </Button>
        </Group>
      </div>
    </main>
  );
}
