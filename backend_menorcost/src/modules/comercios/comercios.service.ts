import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  esCuitValido,
  esRangoHorarioValido,
  estaFranjaContenida,
  FRANJA_FUERA_DE_HORARIO,
  haySolapamientoDeHorarios,
  type RangoHorario,
} from './comercios-rules.js';
import type { ActualizarAperturaDto } from './dto/actualizar-apertura.dto.js';
import type { ActualizarComercioDto } from './dto/actualizar-comercio.dto.js';
import type { GuardarConfiguracionHorariaDto } from './dto/configuracion-horaria.dto.js';
import type { CrearComercioDto } from './dto/crear-comercio.dto.js';
import type { ReemplazarFranjasDto } from './dto/franja-retiro.dto.js';
import type { ReemplazarHorariosDto } from './dto/horario-atencion.dto.js';

const COMERCIO_NO_ENCONTRADO = 'Todavía no tenés un comercio registrado';

const SELECT_HORARIO = {
  id: true,
  diaSemana: true,
  horaInicio: true,
  horaFin: true,
} satisfies Prisma.HorarioAtencionSelect;

const ORDEN_HORARIOS: Prisma.HorarioAtencionOrderByWithRelationInput[] = [
  { diaSemana: 'asc' },
  { horaInicio: 'asc' },
];

const SELECT_FRANJA = {
  ...SELECT_HORARIO,
  activa: true,
} satisfies Prisma.FranjaRetiroSelect;

const SELECT_COMERCIO = {
  idComercio: true,
  mercadoPagoVinculado: true,
  nombreFantasia: true,
  razonSocial: true,
  cuit: true,
  telefono: true,
  descripcion: true,
  calle: true,
  numero: true,
  piso: true,
  localidad: true,
  provincia: true,
  codigoPostal: true,
  latitud: true,
  longitud: true,
  googlePlaceId: true,
  logoUrl: true,
  portadaUrl: true,
  abierto: true,
  estado: true,
  createdAt: true,
  updatedAt: true,
  horarios: {
    select: SELECT_HORARIO,
    orderBy: ORDEN_HORARIOS,
  },
  franjas: {
    select: SELECT_FRANJA,
    orderBy: ORDEN_HORARIOS,
  },
} satisfies Prisma.ComercioSelect;

function aComercioPropio<T extends { idComercio: string }>(
  comercio: T,
): Omit<T, 'idComercio'> & { id: string } {
  const { idComercio, ...resto } = comercio;

  return { id: idComercio, ...resto };
}

@Injectable()
export class ComerciosService {
  constructor(private readonly prisma: PrismaService) {}

  async listarCategorias() {
    const categorias = await this.prisma.categoria.findMany({
      where: { activa: true },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      select: {
        idCategoria: true,
        nombre: true,
        slug: true,
        orden: true,
      },
    });

    return categorias.map((categoria) => ({
      id: categoria.idCategoria,
      nombre: categoria.nombre,
      slug: categoria.slug,
      orden: categoria.orden,
    }));
  }

  async obtenerMio(usuarioId: string) {
    const comercio = await this.prisma.comercio.findUnique({
      where: { usuarioId },
      select: SELECT_COMERCIO,
    });

    if (!comercio) {
      throw new NotFoundException(COMERCIO_NO_ENCONTRADO);
    }

    return aComercioPropio(comercio);
  }

  async crear(usuarioId: string, dto: CrearComercioDto) {
    if (!esCuitValido(dto.cuit)) {
      throw new BadRequestException('El CUIT no es válido');
    }

    try {
      const comercio = await this.prisma.comercio.create({
        data: {
          usuarioId,
          nombreFantasia: dto.nombreFantasia,
          razonSocial: dto.razonSocial,
          cuit: dto.cuit,
          telefono: dto.telefono,
          descripcion: dto.descripcion,
          calle: dto.calle,
          numero: dto.numero,
          piso: dto.piso,
          localidad: dto.localidad,
          provincia: dto.provincia,
          codigoPostal: dto.codigoPostal,
          latitud: dto.latitud,
          longitud: dto.longitud,
          googlePlaceId: dto.googlePlaceId,
          logoUrl: dto.logoUrl,
          portadaUrl: dto.portadaUrl,
        },
        select: SELECT_COMERCIO,
      });

      return aComercioPropio(comercio);
    } catch (error) {
      this.lanzarSiDuplicado(error);
      throw error;
    }
  }

  async actualizarMio(usuarioId: string, dto: ActualizarComercioDto) {
    const tieneCampos = Object.values(dto).some((valor) => valor !== undefined);

    if (!tieneCampos) {
      throw new BadRequestException('No se enviaron campos para actualizar');
    }

    if (dto.cuit !== undefined && !esCuitValido(dto.cuit)) {
      throw new BadRequestException('El CUIT no es válido');
    }

    await this.obtenerIdComercio(usuarioId);

    try {
      const comercio = await this.prisma.comercio.update({
        where: { usuarioId },
        data: {
          nombreFantasia: dto.nombreFantasia,
          razonSocial: dto.razonSocial,
          cuit: dto.cuit,
          telefono: dto.telefono,
          descripcion: dto.descripcion,
          calle: dto.calle,
          numero: dto.numero,
          piso: dto.piso,
          localidad: dto.localidad,
          provincia: dto.provincia,
          codigoPostal: dto.codigoPostal,
          latitud: dto.latitud,
          longitud: dto.longitud,
          googlePlaceId: dto.googlePlaceId,
          logoUrl: dto.logoUrl,
          portadaUrl: dto.portadaUrl,
        },
        select: SELECT_COMERCIO,
      });

      return aComercioPropio(comercio);
    } catch (error) {
      this.lanzarSiDuplicado(error);
      throw error;
    }
  }

  async actualizarApertura(
    usuarioId: string,
    dto: ActualizarAperturaDto,
  ): Promise<{ id: string; abierto: boolean }> {
    await this.obtenerIdComercio(usuarioId);

    const comercio = await this.prisma.comercio.update({
      where: { usuarioId },
      data: { abierto: dto.abierto },
      select: { idComercio: true, abierto: true },
    });

    return { id: comercio.idComercio, abierto: comercio.abierto };
  }

  async obtenerHorarios(usuarioId: string) {
    const comercioId = await this.obtenerIdComercio(usuarioId);

    return this.prisma.horarioAtencion.findMany({
      where: { comercioId },
      orderBy: ORDEN_HORARIOS,
      select: SELECT_HORARIO,
    });
  }

  async reemplazarHorarios(usuarioId: string, dto: ReemplazarHorariosDto) {
    this.validarHorarios(dto.horarios);

    const comercioId = await this.obtenerIdComercio(usuarioId);
    const franjas = await this.prisma.franjaRetiro.findMany({
      where: { comercioId },
      select: SELECT_HORARIO,
    });

    if (franjas.some((franja) => !estaFranjaContenida(franja, dto.horarios))) {
      throw new BadRequestException(FRANJA_FUERA_DE_HORARIO);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.horarioAtencion.deleteMany({ where: { comercioId } });

      if (dto.horarios.length > 0) {
        const actualizadoEn = new Date();

        await tx.horarioAtencion.createMany({
          data: dto.horarios.map((horario) => ({
            comercioId,
            diaSemana: horario.diaSemana,
            horaInicio: horario.horaInicio,
            horaFin: horario.horaFin,
            updatedAt: actualizadoEn,
          })),
        });
      }

      return tx.horarioAtencion.findMany({
        where: { comercioId },
        orderBy: ORDEN_HORARIOS,
        select: SELECT_HORARIO,
      });
    });
  }

  async obtenerFranjas(usuarioId: string) {
    const comercioId = await this.obtenerIdComercio(usuarioId);

    return this.prisma.franjaRetiro.findMany({
      where: { comercioId },
      orderBy: ORDEN_HORARIOS,
      select: SELECT_FRANJA,
    });
  }

  async reemplazarFranjas(usuarioId: string, dto: ReemplazarFranjasDto) {
    this.validarFranjas(dto.franjas);

    const comercioId = await this.obtenerIdComercio(usuarioId);
    const horarios = await this.prisma.horarioAtencion.findMany({
      where: { comercioId },
      select: SELECT_HORARIO,
    });

    if (dto.franjas.some((franja) => !estaFranjaContenida(franja, horarios))) {
      throw new BadRequestException(FRANJA_FUERA_DE_HORARIO);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.franjaRetiro.deleteMany({ where: { comercioId } });

      if (dto.franjas.length > 0) {
        const actualizadoEn = new Date();

        await tx.franjaRetiro.createMany({
          data: dto.franjas.map((franja) => ({
            comercioId,
            diaSemana: franja.diaSemana,
            horaInicio: franja.horaInicio,
            horaFin: franja.horaFin,
            activa: franja.activa ?? true,
            updatedAt: actualizadoEn,
          })),
        });
      }

      return tx.franjaRetiro.findMany({
        where: { comercioId },
        orderBy: ORDEN_HORARIOS,
        select: SELECT_FRANJA,
      });
    });
  }

  async reemplazarConfiguracionHoraria(
    usuarioId: string,
    dto: GuardarConfiguracionHorariaDto,
  ) {
    this.validarHorarios(dto.horarios);
    this.validarFranjas(dto.franjas);

    if (
      dto.franjas.some((franja) => !estaFranjaContenida(franja, dto.horarios))
    ) {
      throw new BadRequestException(FRANJA_FUERA_DE_HORARIO);
    }

    const comercioId = await this.obtenerIdComercio(usuarioId);

    return this.prisma.$transaction(async (tx) => {
      await tx.franjaRetiro.deleteMany({ where: { comercioId } });
      await tx.horarioAtencion.deleteMany({ where: { comercioId } });

      const actualizadoEn = new Date();

      if (dto.horarios.length > 0) {
        await tx.horarioAtencion.createMany({
          data: dto.horarios.map((horario) => ({
            comercioId,
            diaSemana: horario.diaSemana,
            horaInicio: horario.horaInicio,
            horaFin: horario.horaFin,
            updatedAt: actualizadoEn,
          })),
        });
      }

      if (dto.franjas.length > 0) {
        await tx.franjaRetiro.createMany({
          data: dto.franjas.map((franja) => ({
            comercioId,
            diaSemana: franja.diaSemana,
            horaInicio: franja.horaInicio,
            horaFin: franja.horaFin,
            activa: franja.activa ?? true,
            updatedAt: actualizadoEn,
          })),
        });
      }

      const [horarios, franjas] = await Promise.all([
        tx.horarioAtencion.findMany({
          where: { comercioId },
          orderBy: ORDEN_HORARIOS,
          select: SELECT_HORARIO,
        }),
        tx.franjaRetiro.findMany({
          where: { comercioId },
          orderBy: ORDEN_HORARIOS,
          select: SELECT_FRANJA,
        }),
      ]);

      return { horarios, franjas };
    });
  }

  private validarHorarios(horarios: RangoHorario[]): void {
    for (const horario of horarios) {
      if (!esRangoHorarioValido(horario)) {
        throw new BadRequestException(
          'La hora de fin debe ser posterior a la hora de inicio',
        );
      }
    }

    if (haySolapamientoDeHorarios(horarios)) {
      throw new BadRequestException(
        'Los horarios de un mismo día no pueden superponerse',
      );
    }
  }

  private validarFranjas(franjas: RangoHorario[]): void {
    for (const franja of franjas) {
      if (!esRangoHorarioValido(franja)) {
        throw new BadRequestException(
          'La hora de fin debe ser posterior a la hora de inicio',
        );
      }
    }
  }

  private async obtenerIdComercio(usuarioId: string): Promise<string> {
    const comercio = await this.prisma.comercio.findUnique({
      where: { usuarioId },
      select: { idComercio: true },
    });

    if (!comercio) {
      throw new NotFoundException(COMERCIO_NO_ENCONTRADO);
    }

    return comercio.idComercio;
  }

  private lanzarSiDuplicado(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(this.mensajeDuplicado(error));
    }
  }

  private mensajeDuplicado(
    error: Prisma.PrismaClientKnownRequestError,
  ): string {
    const target = error.meta?.['target'];
    const campos = Array.isArray(target)
      ? target.map(String)
      : typeof target === 'string'
        ? [target]
        : [];

    if (campos.some((campo) => campo.includes('usuario'))) {
      return 'Ya tenés un comercio registrado';
    }

    if (campos.some((campo) => campo.includes('cuit'))) {
      return 'Ya existe un comercio con ese CUIT';
    }

    if (
      campos.some(
        (campo) =>
          campo.includes('google_place_id') || campo.includes('googlePlaceId'),
      )
    ) {
      return 'Ya existe un comercio vinculado a ese lugar de Google';
    }

    return 'Ya existe un comercio con esos datos';
  }
}
