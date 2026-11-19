import { BadRequestException, Injectable } from '@nestjs/common';
import {
  diaSemanaArgentina,
  etiquetaRetiro,
  fechaArgentinaISO,
  horaArgentinaHHMM,
  sumarDiasISO,
} from '../../common/utils/fechas-ar.util.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { estaFranjaContenida } from '../comercios/comercios-rules.js';
import type { CheckoutFranja } from './pedidos.types.js';

interface FranjaRow {
  id: string;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
}

const SELECT_FRANJA = {
  id: true,
  diaSemana: true,
  horaInicio: true,
  horaFin: true,
} as const;

/**
 * Lectura y validación de franjas de retiro para el checkout del cliente.
 *
 * No modifica nada del módulo de comercios: solo lee `franja_retiro` y
 * `horario_atencion`, y reutiliza `estaFranjaContenida` de sus reglas.
 */
@Injectable()
export class FranjasService {
  constructor(private readonly prisma: PrismaService) {}

  async listarParaCheckout(
    comercioId: string,
    ahora: Date = new Date(),
  ): Promise<CheckoutFranja[]> {
    const franjas = await this.prisma.franjaRetiro.findMany({
      where: { comercioId, activa: true },
      select: SELECT_FRANJA,
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
    });

    return franjas.map((franja) => this.aCheckoutFranja(franja, ahora));
  }

  /**
   * Regla de oro: nunca confiar en la franja que manda el frontend.
   * Se valida contra la base que exista, que sea del comercio, que esté
   * activa y que siga contenida en el horario de atención vigente.
   */
  async validarParaCheckout(
    comercioId: string,
    franjaHorarioId: string,
    ahora: Date = new Date(),
  ): Promise<CheckoutFranja> {
    const franja = await this.prisma.franjaRetiro.findFirst({
      where: { id: franjaHorarioId, comercioId, activa: true },
      select: SELECT_FRANJA,
    });

    if (!franja) {
      throw new BadRequestException(
        'La franja de retiro seleccionada no está habilitada para este comercio.',
      );
    }

    const horarios = await this.prisma.horarioAtencion.findMany({
      where: { comercioId, diaSemana: franja.diaSemana },
      select: { diaSemana: true, horaInicio: true, horaFin: true },
    });

    if (!estaFranjaContenida(franja, horarios)) {
      throw new BadRequestException(
        'La franja de retiro seleccionada quedó fuera del horario de atención del comercio.',
      );
    }

    return this.aCheckoutFranja(franja, ahora);
  }

  private aCheckoutFranja(
    franja: FranjaRow,
    ahora: Date,
  ): CheckoutFranja {
    const fechaRetiro = this.proximaFecha(franja, ahora);

    return {
      ...franja,
      fechaRetiro,
      etiqueta: etiquetaRetiro(fechaRetiro, franja.horaInicio, franja.horaFin),
    };
  }

  /**
   * Próxima fecha concreta de retiro para el día de la semana de la franja.
   * Si la franja de hoy ya empezó, se ofrece la de la semana siguiente.
   */
  private proximaFecha(franja: FranjaRow, ahora: Date): string {
    const hoy = fechaArgentinaISO(ahora);
    const diaHoy = diaSemanaArgentina(ahora);
    const horaActual = horaArgentinaHHMM(ahora);

    let dias = (franja.diaSemana - diaHoy + 7) % 7;

    if (dias === 0 && horaActual >= franja.horaInicio) {
      dias = 7;
    }

    return sumarDiasISO(hoy, dias);
  }
}
