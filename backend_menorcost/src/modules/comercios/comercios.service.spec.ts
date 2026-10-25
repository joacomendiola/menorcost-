import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { FRANJA_FUERA_DE_HORARIO } from './comercios-rules.js';
import { ComerciosService } from './comercios.service.js';
import type { CrearComercioDto } from './dto/crear-comercio.dto.js';

const txMock = {
  horarioAtencion: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
  },
  franjaRetiro: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
  },
};

const prismaMock = {
  categoria: { findMany: vi.fn() },
  comercio: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  horarioAtencion: { findMany: vi.fn() },
  franjaRetiro: { findMany: vi.fn() },
  $transaction: vi.fn(),
};

const service = new ComerciosService(prismaMock as never);

const dto = {
  nombreFantasia: 'Almacén Don José',
  razonSocial: 'Don José S.R.L.',
  cuit: '20123456786',
  telefono: '2901123456',
  descripcion: 'Almacén de barrio',
  calle: 'San Martín',
  numero: '123',
  piso: 'PB',
  localidad: 'Ushuaia',
  provincia: 'Tierra del Fuego',
  codigoPostal: '9410',
  latitud: -54.8019,
  longitud: -68.303,
  googlePlaceId: 'ChIJtest',
  logoUrl: 'https://cdn.menorcost.test/logo.png',
  portadaUrl: 'https://cdn.menorcost.test/portada.png',
} satisfies CrearComercioDto;

const comercioBase = {
  idComercio: 'c1',
  nombreFantasia: 'Almacén Don José',
  horarios: [],
  franjas: [],
};

const horarioBase = {
  id: 'h1',
  diaSemana: 1,
  horaInicio: '09:00',
  horaFin: '18:00',
};

const franjaBase = {
  id: 'f1',
  diaSemana: 1,
  horaInicio: '10:00',
  horaFin: '12:00',
  activa: true,
};

function errorDuplicado(
  target: string[],
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: unknown) => unknown)(txMock)
      : Promise.all(arg as Promise<unknown>[]),
  );
});

describe('ComerciosService.listarCategorias', () => {
  it('devuelve solo categorías activas ordenadas y con id público', async () => {
    prismaMock.categoria.findMany.mockResolvedValue([
      {
        idCategoria: 'cat-1',
        nombre: 'Bebidas',
        slug: 'bebidas',
        orden: 4,
      },
    ]);

    await expect(service.listarCategorias()).resolves.toEqual([
      { id: 'cat-1', nombre: 'Bebidas', slug: 'bebidas', orden: 4 },
    ]);

    expect(prismaMock.categoria.findMany).toHaveBeenCalledWith({
      where: { activa: true },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      select: {
        idCategoria: true,
        nombre: true,
        slug: true,
        orden: true,
      },
    });
  });
});

describe('ComerciosService.obtenerMio', () => {
  it('rechaza si el usuario todavía no tiene comercio', async () => {
    prismaMock.comercio.findUnique.mockResolvedValue(null);

    await expect(service.obtenerMio('u1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('devuelve el comercio propio con id público', async () => {
    prismaMock.comercio.findUnique.mockResolvedValue(comercioBase);

    const resultado = await service.obtenerMio('u1');

    expect(prismaMock.comercio.findUnique).toHaveBeenCalledWith({
      where: { usuarioId: 'u1' },
      select: expect.any(Object),
    });
    expect(resultado).toMatchObject({
      id: 'c1',
      nombreFantasia: 'Almacén Don José',
    });
    expect(resultado).not.toHaveProperty('idComercio');
  });
});

describe('ComerciosService.crear', () => {
  it('rechaza un CUIT con dígito verificador inválido', async () => {
    await expect(
      service.crear('u1', { ...dto, cuit: '20123456780' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.comercio.create).not.toHaveBeenCalled();
  });

  it('crea el comercio asociado al usuario autenticado', async () => {
    prismaMock.comercio.create.mockResolvedValue(comercioBase);

    const resultado = await service.crear('u1', dto);

    expect(prismaMock.comercio.create).toHaveBeenCalledWith({
      data: { usuarioId: 'u1', ...dto },
      select: expect.any(Object),
    });
    expect(resultado).toMatchObject({ id: 'c1' });
    expect(resultado).not.toHaveProperty('idComercio');
  });

  it.each([
    [['usuario_id'], 'Ya tenés un comercio registrado'],
    [['cuit'], 'Ya existe un comercio con ese CUIT'],
    [['comercio_cuit_key'], 'Ya existe un comercio con ese CUIT'],
    [
      ['google_place_id'],
      'Ya existe un comercio vinculado a ese lugar de Google',
    ],
    [
      ['comercio_google_place_id_key'],
      'Ya existe un comercio vinculado a ese lugar de Google',
    ],
  ])('traduce el duplicado de %j a un conflicto', async (target, mensaje) => {
    prismaMock.comercio.create.mockRejectedValue(errorDuplicado(target));

    await expect(service.crear('u1', dto)).rejects.toThrow(
      new ConflictException(mensaje),
    );
  });
});

describe('ComerciosService.actualizarMio', () => {
  it('rechaza una actualización vacía', async () => {
    await expect(service.actualizarMio('u1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prismaMock.comercio.findUnique).not.toHaveBeenCalled();
  });

  it('rechaza un CUIT inválido antes de actualizar', async () => {
    await expect(
      service.actualizarMio('u1', { cuit: '20123456780' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.comercio.update).not.toHaveBeenCalled();
  });

  it('rechaza si el usuario todavía no tiene comercio', async () => {
    prismaMock.comercio.findUnique.mockResolvedValue(null);

    await expect(
      service.actualizarMio('u1', { telefono: '2901123456' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('actualiza solo los campos enviados', async () => {
    prismaMock.comercio.findUnique.mockResolvedValue({ idComercio: 'c1' });
    prismaMock.comercio.update.mockResolvedValue(comercioBase);

    const resultado = await service.actualizarMio('u1', {
      telefono: '2901999999',
    });

    expect(prismaMock.comercio.update).toHaveBeenCalledWith({
      where: { usuarioId: 'u1' },
      data: expect.objectContaining({ telefono: '2901999999' }),
      select: expect.any(Object),
    });
    expect(resultado).toMatchObject({ id: 'c1' });
  });

  it('traduce duplicados al actualizar', async () => {
    prismaMock.comercio.findUnique.mockResolvedValue({ idComercio: 'c1' });
    prismaMock.comercio.update.mockRejectedValue(errorDuplicado(['cuit']));

    await expect(
      service.actualizarMio('u1', { cuit: '20123456786' }),
    ).rejects.toThrow(
      new ConflictException('Ya existe un comercio con ese CUIT'),
    );
  });
});

describe('ComerciosService.actualizarApertura', () => {
  it('rechaza si el usuario todavía no tiene comercio', async () => {
    prismaMock.comercio.findUnique.mockResolvedValue(null);

    await expect(
      service.actualizarApertura('u1', { abierto: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('actualiza el estado de apertura', async () => {
    prismaMock.comercio.findUnique.mockResolvedValue({ idComercio: 'c1' });
    prismaMock.comercio.update.mockResolvedValue({
      idComercio: 'c1',
      abierto: true,
    });

    await expect(
      service.actualizarApertura('u1', { abierto: true }),
    ).resolves.toEqual({ id: 'c1', abierto: true });

    expect(prismaMock.comercio.update).toHaveBeenCalledWith({
      where: { usuarioId: 'u1' },
      data: { abierto: true },
      select: { idComercio: true, abierto: true },
    });
  });
});

describe('ComerciosService.obtenerHorarios', () => {
  it('rechaza si el usuario todavía no tiene comercio', async () => {
    prismaMock.comercio.findUnique.mockResolvedValue(null);

    await expect(service.obtenerHorarios('u1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('devuelve los horarios ordenados', async () => {
    prismaMock.comercio.findUnique.mockResolvedValue({ idComercio: 'c1' });
    prismaMock.horarioAtencion.findMany.mockResolvedValue([horarioBase]);

    await expect(service.obtenerHorarios('u1')).resolves.toEqual([horarioBase]);

    expect(prismaMock.horarioAtencion.findMany).toHaveBeenCalledWith({
      where: { comercioId: 'c1' },
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
      select: expect.any(Object),
    });
  });
});

describe('ComerciosService.reemplazarHorarios', () => {
  it('rechaza un rango con fin anterior al inicio', async () => {
    await expect(
      service.reemplazarHorarios('u1', {
        horarios: [{ diaSemana: 1, horaInicio: '18:00', horaFin: '09:00' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.comercio.findUnique).not.toHaveBeenCalled();
  });

  it('rechaza horarios superpuestos del mismo día', async () => {
    await expect(
      service.reemplazarHorarios('u1', {
        horarios: [
          { diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' },
          { diaSemana: 1, horaInicio: '12:00', horaFin: '18:00' },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.comercio.findUnique).not.toHaveBeenCalled();
  });

  it('rechaza horarios que dejarían afuera una franja existente', async () => {
    prismaMock.comercio.findUnique.mockResolvedValue({ idComercio: 'c1' });
    prismaMock.franjaRetiro.findMany.mockResolvedValue([franjaBase]);

    await expect(
      service.reemplazarHorarios('u1', {
        horarios: [{ diaSemana: 1, horaInicio: '13:00', horaFin: '18:00' }],
      }),
    ).rejects.toThrow(new BadRequestException(FRANJA_FUERA_DE_HORARIO));

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('reemplaza los horarios dentro de una transacción', async () => {
    prismaMock.comercio.findUnique.mockResolvedValue({ idComercio: 'c1' });
    prismaMock.franjaRetiro.findMany.mockResolvedValue([]);
    txMock.horarioAtencion.deleteMany.mockResolvedValue({ count: 1 });
    txMock.horarioAtencion.createMany.mockResolvedValue({ count: 1 });
    txMock.horarioAtencion.findMany.mockResolvedValue([horarioBase]);

    await expect(
      service.reemplazarHorarios('u1', { horarios: [horarioBase] }),
    ).resolves.toEqual([horarioBase]);

    expect(txMock.horarioAtencion.deleteMany).toHaveBeenCalledWith({
      where: { comercioId: 'c1' },
    });
    expect(txMock.horarioAtencion.createMany).toHaveBeenCalledWith({
      data: [
        {
          comercioId: 'c1',
          diaSemana: 1,
          horaInicio: '09:00',
          horaFin: '18:00',
          updatedAt: expect.any(Date),
        },
      ],
    });
    expect(txMock.horarioAtencion.findMany).toHaveBeenCalledWith({
      where: { comercioId: 'c1' },
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
      select: expect.any(Object),
    });
  });

  it('permite vaciar todos los horarios', async () => {
    prismaMock.comercio.findUnique.mockResolvedValue({ idComercio: 'c1' });
    prismaMock.franjaRetiro.findMany.mockResolvedValue([]);
    txMock.horarioAtencion.deleteMany.mockResolvedValue({ count: 1 });
    txMock.horarioAtencion.findMany.mockResolvedValue([]);

    await expect(
      service.reemplazarHorarios('u1', { horarios: [] }),
    ).resolves.toEqual([]);

    expect(txMock.horarioAtencion.createMany).not.toHaveBeenCalled();
  });
});

describe('ComerciosService.obtenerFranjas', () => {
  it('rechaza si el usuario todavía no tiene comercio', async () => {
    prismaMock.comercio.findUnique.mockResolvedValue(null);

    await expect(service.obtenerFranjas('u1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('devuelve las franjas ordenadas', async () => {
    prismaMock.comercio.findUnique.mockResolvedValue({ idComercio: 'c1' });
    prismaMock.franjaRetiro.findMany.mockResolvedValue([franjaBase]);

    await expect(service.obtenerFranjas('u1')).resolves.toEqual([franjaBase]);

    expect(prismaMock.franjaRetiro.findMany).toHaveBeenCalledWith({
      where: { comercioId: 'c1' },
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
      select: expect.any(Object),
    });
  });
});

describe('ComerciosService.reemplazarFranjas', () => {
  it('rechaza un rango con fin anterior al inicio', async () => {
    await expect(
      service.reemplazarFranjas('u1', {
        franjas: [
          {
            diaSemana: 1,
            horaInicio: '12:00',
            horaFin: '11:00',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.comercio.findUnique).not.toHaveBeenCalled();
  });

  it('rechaza una franja fuera del horario de atención', async () => {
    prismaMock.comercio.findUnique.mockResolvedValue({ idComercio: 'c1' });
    prismaMock.horarioAtencion.findMany.mockResolvedValue([
      { id: 'h1', diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' },
    ]);

    await expect(
      service.reemplazarFranjas('u1', {
        franjas: [
          {
            diaSemana: 1,
            horaInicio: '14:00',
            horaFin: '15:00',
          },
        ],
      }),
    ).rejects.toThrow(new BadRequestException(FRANJA_FUERA_DE_HORARIO));

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('reemplaza las franjas dentro de una transacción', async () => {
    prismaMock.comercio.findUnique.mockResolvedValue({ idComercio: 'c1' });
    prismaMock.horarioAtencion.findMany.mockResolvedValue([horarioBase]);
    txMock.franjaRetiro.deleteMany.mockResolvedValue({ count: 1 });
    txMock.franjaRetiro.createMany.mockResolvedValue({ count: 1 });
    txMock.franjaRetiro.findMany.mockResolvedValue([franjaBase]);

    await expect(
      service.reemplazarFranjas('u1', {
        franjas: [
          {
            diaSemana: 1,
            horaInicio: '10:00',
            horaFin: '12:00',
          },
        ],
      }),
    ).resolves.toEqual([franjaBase]);

    expect(txMock.franjaRetiro.deleteMany).toHaveBeenCalledWith({
      where: { comercioId: 'c1' },
    });
    expect(txMock.franjaRetiro.createMany).toHaveBeenCalledWith({
      data: [
        {
          comercioId: 'c1',
          diaSemana: 1,
          horaInicio: '10:00',
          horaFin: '12:00',
          activa: true,
          updatedAt: expect.any(Date),
        },
      ],
    });
    expect(txMock.franjaRetiro.findMany).toHaveBeenCalledWith({
      where: { comercioId: 'c1' },
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
      select: expect.any(Object),
    });
  });

  it('permite vaciar todas las franjas', async () => {
    prismaMock.comercio.findUnique.mockResolvedValue({ idComercio: 'c1' });
    prismaMock.horarioAtencion.findMany.mockResolvedValue([horarioBase]);
    txMock.franjaRetiro.deleteMany.mockResolvedValue({ count: 1 });
    txMock.franjaRetiro.findMany.mockResolvedValue([]);

    await expect(
      service.reemplazarFranjas('u1', { franjas: [] }),
    ).resolves.toEqual([]);

    expect(txMock.franjaRetiro.createMany).not.toHaveBeenCalled();
  });
});

describe('ComerciosService.reemplazarConfiguracionHoraria', () => {
  it('rechaza franjas fuera de los nuevos horarios', async () => {
    await expect(
      service.reemplazarConfiguracionHoraria('u1', {
        horarios: [{ diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' }],
        franjas: [{ diaSemana: 1, horaInicio: '14:00', horaFin: '15:00' }],
      }),
    ).rejects.toThrow(new BadRequestException(FRANJA_FUERA_DE_HORARIO));

    expect(prismaMock.comercio.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('reemplaza horarios y franjas en una sola transacción', async () => {
    prismaMock.comercio.findUnique.mockResolvedValue({ idComercio: 'c1' });
    txMock.horarioAtencion.deleteMany.mockResolvedValue({ count: 1 });
    txMock.franjaRetiro.deleteMany.mockResolvedValue({ count: 1 });
    txMock.horarioAtencion.createMany.mockResolvedValue({ count: 1 });
    txMock.franjaRetiro.createMany.mockResolvedValue({ count: 1 });
    txMock.horarioAtencion.findMany.mockResolvedValue([horarioBase]);
    txMock.franjaRetiro.findMany.mockResolvedValue([franjaBase]);

    await expect(
      service.reemplazarConfiguracionHoraria('u1', {
        horarios: [horarioBase],
        franjas: [
          {
            diaSemana: 1,
            horaInicio: '10:00',
            horaFin: '12:00',
          },
        ],
      }),
    ).resolves.toEqual({
      horarios: [horarioBase],
      franjas: [franjaBase],
    });

    expect(txMock.horarioAtencion.deleteMany).toHaveBeenCalledWith({
      where: { comercioId: 'c1' },
    });
    expect(txMock.franjaRetiro.deleteMany).toHaveBeenCalledWith({
      where: { comercioId: 'c1' },
    });
    expect(txMock.horarioAtencion.createMany).toHaveBeenCalled();
    expect(txMock.franjaRetiro.createMany).toHaveBeenCalled();
  });
});
