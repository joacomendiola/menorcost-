import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { CategoriasController } from './categorias.controller.js';
import { ComerciosController } from './comercios.controller.js';
import { ComerciosService } from './comercios.service.js';
import type { CrearComercioDto } from './dto/crear-comercio.dto.js';

describe('Controladores de comercios', () => {
  const usuario: AuthenticatedUser = {
    id: 'u1',
    email: 'comercio@example.com',
    rol: 'COMERCIANTE',
    estado: 'HABILITADO',
  };

  const dto: CrearComercioDto = {
    nombreFantasia: 'Almacén Don José',
    razonSocial: 'Don José S.R.L.',
    cuit: '20123456786',
    telefono: '2901123456',
    calle: 'San Martín',
    numero: '123',
    localidad: 'Ushuaia',
    provincia: 'Tierra del Fuego',
    latitud: -54.8019,
    longitud: -68.303,
    googlePlaceId: 'ChIJtest',
  };

  const serviceMock = {
    listarCategorias: vi.fn(),
    obtenerMio: vi.fn(),
    crear: vi.fn(),
    actualizarMio: vi.fn(),
    actualizarApertura: vi.fn(),
    obtenerHorarios: vi.fn(),
    reemplazarHorarios: vi.fn(),
    obtenerFranjas: vi.fn(),
    reemplazarFranjas: vi.fn(),
    reemplazarConfiguracionHoraria: vi.fn(),
  };

  let comerciosController: ComerciosController;
  let categoriasController: CategoriasController;

  beforeEach(async () => {
    vi.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [ComerciosController, CategoriasController],
      providers: [
        {
          provide: ComerciosService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    comerciosController = moduleRef.get(ComerciosController);
    categoriasController = moduleRef.get(CategoriasController);
  });

  it('lista las categorías desde el servicio', async () => {
    const categorias = [{ id: 'cat-1', nombre: 'Bebidas' }];
    serviceMock.listarCategorias.mockResolvedValue(categorias);

    await expect(categoriasController.listar()).resolves.toEqual(categorias);
    expect(serviceMock.listarCategorias).toHaveBeenCalledOnce();
  });

  it('obtiene el comercio del usuario autenticado', async () => {
    const comercio = { id: 'c1' };
    serviceMock.obtenerMio.mockResolvedValue(comercio);

    await expect(comerciosController.obtenerMio(usuario)).resolves.toEqual(
      comercio,
    );
    expect(serviceMock.obtenerMio).toHaveBeenCalledWith('u1');
  });

  it('crea el comercio del usuario autenticado', async () => {
    const comercio = { id: 'c1' };
    serviceMock.crear.mockResolvedValue(comercio);

    await expect(comerciosController.crear(usuario, dto)).resolves.toEqual(
      comercio,
    );
    expect(serviceMock.crear).toHaveBeenCalledWith('u1', dto);
  });

  it('actualiza el comercio del usuario autenticado', async () => {
    const cambios = { telefono: '2901999999' };
    const comercio = { id: 'c1', telefono: '2901999999' };
    serviceMock.actualizarMio.mockResolvedValue(comercio);

    await expect(
      comerciosController.actualizarMio(usuario, cambios),
    ).resolves.toEqual(comercio);
    expect(serviceMock.actualizarMio).toHaveBeenCalledWith('u1', cambios);
  });

  it('actualiza la apertura del comercio', async () => {
    const apertura = { id: 'c1', abierto: true };
    serviceMock.actualizarApertura.mockResolvedValue(apertura);

    await expect(
      comerciosController.actualizarApertura(usuario, { abierto: true }),
    ).resolves.toEqual(apertura);
    expect(serviceMock.actualizarApertura).toHaveBeenCalledWith('u1', {
      abierto: true,
    });
  });

  it('obtiene los horarios del comercio', async () => {
    const horarios = [
      { id: 'h1', diaSemana: 1, horaInicio: '09:00', horaFin: '18:00' },
    ];
    serviceMock.obtenerHorarios.mockResolvedValue(horarios);

    await expect(comerciosController.obtenerHorarios(usuario)).resolves.toEqual(
      horarios,
    );
    expect(serviceMock.obtenerHorarios).toHaveBeenCalledWith('u1');
  });

  it('reemplaza los horarios del comercio', async () => {
    const horariosDto = {
      horarios: [{ diaSemana: 1, horaInicio: '09:00', horaFin: '18:00' }],
    };
    const horarios = [{ id: 'h1', ...horariosDto.horarios[0] }];
    serviceMock.reemplazarHorarios.mockResolvedValue(horarios);

    await expect(
      comerciosController.reemplazarHorarios(usuario, horariosDto),
    ).resolves.toEqual(horarios);
    expect(serviceMock.reemplazarHorarios).toHaveBeenCalledWith(
      'u1',
      horariosDto,
    );
  });

  it('obtiene las franjas de retiro del comercio', async () => {
    const franjas = [
      {
        id: 'f1',
        diaSemana: 1,
        horaInicio: '10:00',
        horaFin: '12:00',
        activa: true,
      },
    ];
    serviceMock.obtenerFranjas.mockResolvedValue(franjas);

    await expect(comerciosController.obtenerFranjas(usuario)).resolves.toEqual(
      franjas,
    );
    expect(serviceMock.obtenerFranjas).toHaveBeenCalledWith('u1');
  });

  it('reemplaza las franjas de retiro del comercio', async () => {
    const franjasDto = {
      franjas: [{ diaSemana: 1, horaInicio: '10:00', horaFin: '12:00' }],
    };
    const franjas = [{ id: 'f1', ...franjasDto.franjas[0], activa: true }];
    serviceMock.reemplazarFranjas.mockResolvedValue(franjas);

    await expect(
      comerciosController.reemplazarFranjas(usuario, franjasDto),
    ).resolves.toEqual(franjas);
    expect(serviceMock.reemplazarFranjas).toHaveBeenCalledWith(
      'u1',
      franjasDto,
    );
  });

  it('guarda la configuración horaria completa', async () => {
    const configuracion = {
      horarios: [{ diaSemana: 1, horaInicio: '09:00', horaFin: '18:00' }],
      franjas: [{ diaSemana: 1, horaInicio: '10:00', horaFin: '12:00' }],
    };
    serviceMock.reemplazarConfiguracionHoraria.mockResolvedValue(configuracion);

    await expect(
      comerciosController.reemplazarConfiguracionHoraria(
        usuario,
        configuracion,
      ),
    ).resolves.toEqual(configuracion);
    expect(serviceMock.reemplazarConfiguracionHoraria).toHaveBeenCalledWith(
      'u1',
      configuracion,
    );
  });
});
