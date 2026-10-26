import { ActionIcon, Button, Switch, TextInput } from '@mantine/core';
import type { ChangeEvent } from 'react';
import type { FranjaPayload, HorarioPayload } from './api';
import { DIAS, ORDEN_DIAS } from './configuracion';
import './comercios.css';

interface HorariosEditorProps {
  horarios: HorarioPayload[];
  franjas: FranjaPayload[];
  onChange: (horarios: HorarioPayload[], franjas: FranjaPayload[]) => void;
  disabled?: boolean;
}

function obtenerFranjaSugerida(
  dia: number,
  horarios: HorarioPayload[],
): FranjaPayload {
  const primerHorario = horarios.find((horario) => horario.diaSemana === dia);

  return {
    diaSemana: dia,
    horaInicio: primerHorario?.horaInicio ?? '10:00',
    horaFin: primerHorario?.horaFin ?? '12:00',
    activa: true,
  };
}

export function HorariosEditor({
  horarios,
  franjas,
  onChange,
  disabled = false,
}: HorariosEditorProps) {
  function agregarHorario(dia: number) {
    onChange(
      [...horarios, { diaSemana: dia, horaInicio: '09:00', horaFin: '18:00' }],
      franjas,
    );
  }

  function actualizarHorario(
    indice: number,
    campo: 'horaInicio' | 'horaFin',
    valor: string,
  ) {
    onChange(
      horarios.map((horario, posicion) =>
        posicion === indice ? { ...horario, [campo]: valor } : horario,
      ),
      franjas,
    );
  }

  function quitarHorario(indice: number) {
    const horario = horarios[indice];
    if (!horario) return;

    const franjasRestantes = franjas.filter(
      (franja) =>
        !(
          franja.diaSemana === horario.diaSemana &&
          horario.horaInicio <= franja.horaInicio &&
          franja.horaFin <= horario.horaFin
        ),
    );

    onChange(
      horarios.filter((_, posicion) => posicion !== indice),
      franjasRestantes,
    );
  }

  function agregarFranja(dia: number) {
    onChange(horarios, [...franjas, obtenerFranjaSugerida(dia, horarios)]);
  }

  function actualizarFranja(
    indice: number,
    campo: 'horaInicio' | 'horaFin' | 'activa',
    valor: string | boolean,
  ) {
    onChange(
      horarios,
      franjas.map((franja, posicion) =>
        posicion === indice ? { ...franja, [campo]: valor } : franja,
      ),
    );
  }

  function quitarFranja(indice: number) {
    onChange(
      horarios,
      franjas.filter((_, posicion) => posicion !== indice),
    );
  }

  return (
    <div>
      <div className="comercio-editor__seccion">
        <h3>Horarios de atención</h3>
        <p className="help">
          Cada rango debe terminar después de empezar y no puede pisarse con
          otro del mismo día.
        </p>
      </div>

      {ORDEN_DIAS.map((dia) => {
        const rangos = horarios
          .map((horario, indice) => ({ horario, indice }))
          .filter(({ horario }) => horario.diaSemana === dia);

        return (
          <div key={dia} className="comercio-dia">
            <div className="comercio-dia__cabecera">
              <strong>{DIAS[dia]}</strong>
              <Button
                type="button"
                variant="subtle"
                size="compact-sm"
                disabled={disabled}
                onClick={() => agregarHorario(dia)}
              >
                + Agregar horario
              </Button>
            </div>

            {rangos.length === 0 ? (
              <span className="comercio-vacio">Cerrado</span>
            ) : (
              <div className="comercio-rangos">
                {rangos.map(({ horario, indice }) => (
                  <div key={indice} className="comercio-rango">
                    <TextInput
                      type="time"
                      aria-label={`Hora de inicio del ${DIAS[dia]}`}
                      value={horario.horaInicio}
                      disabled={disabled}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        actualizarHorario(
                          indice,
                          'horaInicio',
                          event.currentTarget.value,
                        )
                      }
                    />
                    <TextInput
                      type="time"
                      aria-label={`Hora de fin del ${DIAS[dia]}`}
                      value={horario.horaFin}
                      disabled={disabled}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        actualizarHorario(
                          indice,
                          'horaFin',
                          event.currentTarget.value,
                        )
                      }
                    />
                    <ActionIcon
                      type="button"
                      variant="subtle"
                      color="red"
                      size="lg"
                      className="comercio-rango__quitar"
                      aria-label={`Quitar horario del ${DIAS[dia]}`}
                      disabled={disabled}
                      onClick={() => quitarHorario(indice)}
                    >
                      ×
                    </ActionIcon>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div className="comercio-editor__seccion">
        <h3>Franjas de retiro</h3>
        <p className="help">
          Las franjas son los turnos en los que el cliente puede retirar un
          pedido. Deben quedar dentro de un horario de atención del mismo día.
        </p>
      </div>

      {ORDEN_DIAS.map((dia) => {
        const rangosAtencion = horarios.filter(
          (horario) => horario.diaSemana === dia,
        );
        const franjasDelDia = franjas
          .map((franja, indice) => ({ franja, indice }))
          .filter(({ franja }) => franja.diaSemana === dia);

        return (
          <div key={`franja-${dia}`} className="comercio-dia">
            <div className="comercio-dia__cabecera">
              <strong>{DIAS[dia]}</strong>
              <Button
                type="button"
                variant="subtle"
                size="compact-sm"
                disabled={disabled || rangosAtencion.length === 0}
                onClick={() => agregarFranja(dia)}
              >
                + Agregar franja
              </Button>
            </div>

            {rangosAtencion.length === 0 ? (
              <span className="comercio-vacio">
                Configurá primero un horario de atención para este día.
              </span>
            ) : franjasDelDia.length === 0 ? (
              <span className="comercio-vacio">Sin franjas de retiro</span>
            ) : (
              <div className="comercio-rangos">
                {franjasDelDia.map(({ franja, indice }) => (
                  <div
                    key={indice}
                    className="comercio-rango comercio-rango--franja"
                  >
                    <TextInput
                      type="time"
                      aria-label={`Inicio de la franja del ${DIAS[dia]}`}
                      value={franja.horaInicio}
                      disabled={disabled}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        actualizarFranja(
                          indice,
                          'horaInicio',
                          event.currentTarget.value,
                        )
                      }
                    />
                    <TextInput
                      type="time"
                      aria-label={`Fin de la franja del ${DIAS[dia]}`}
                      value={franja.horaFin}
                      disabled={disabled}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        actualizarFranja(
                          indice,
                          'horaFin',
                          event.currentTarget.value,
                        )
                      }
                    />
                    <Switch
                      size="sm"
                      label="Activa"
                      checked={franja.activa ?? true}
                      disabled={disabled}
                      onChange={(event) =>
                        actualizarFranja(
                          indice,
                          'activa',
                          event.currentTarget.checked,
                        )
                      }
                    />
                    <ActionIcon
                      type="button"
                      variant="subtle"
                      color="red"
                      size="lg"
                      className="comercio-rango__quitar"
                      aria-label={`Quitar franja del ${DIAS[dia]}`}
                      disabled={disabled}
                      onClick={() => quitarFranja(indice)}
                    >
                      ×
                    </ActionIcon>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
