import 'dotenv/config';
import { hash } from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import type {
  EstadoComercio,
  EstadoPedido,
  EstadoProducto,
  EstadoReporte,
  EstadoSolicitudBaja,
  EstadoUsuario,
  MotivoReporte,
  Rol,
  TipoDestinoReporte,
} from '../src/generated/prisma/enums.js';

type CategoriaSeed = {
  nombre: string;
  slug: string;
  orden: number;
  subcategorias: Array<{
    nombre: string;
    slug: string;
    orden: number;
  }>;
};

const categorias: CategoriaSeed[] = [
  {
    nombre: 'Almacén',
    slug: 'almacen',
    orden: 1,
    subcategorias: [
      { nombre: 'Aceites y conservas', slug: 'aceites-y-conservas', orden: 1 },
      { nombre: 'Arroz y pastas', slug: 'arroz-y-pastas', orden: 2 },
      { nombre: 'Harinas y legumbres', slug: 'harinas-y-legumbres', orden: 3 },
      { nombre: 'Condimentos', slug: 'condimentos', orden: 4 },
    ],
  },
  {
    nombre: 'Lácteos',
    slug: 'lacteos',
    orden: 2,
    subcategorias: [
      { nombre: 'Leches', slug: 'leches', orden: 1 },
      { nombre: 'Yogures', slug: 'yogures', orden: 2 },
      { nombre: 'Quesos', slug: 'quesos', orden: 3 },
      { nombre: 'Manteca y crema', slug: 'manteca-y-crema', orden: 4 },
    ],
  },
  {
    nombre: 'Fiambrería',
    slug: 'fiambreria',
    orden: 3,
    subcategorias: [
      { nombre: 'Jamones', slug: 'jamones', orden: 1 },
      { nombre: 'Embutidos', slug: 'embutidos', orden: 2 },
      { nombre: 'Picadas', slug: 'picadas', orden: 3 },
    ],
  },
  {
    nombre: 'Bebidas',
    slug: 'bebidas',
    orden: 4,
    subcategorias: [
      { nombre: 'Gaseosas', slug: 'gaseosas', orden: 1 },
      { nombre: 'Aguas y jugos', slug: 'aguas-y-jugos', orden: 2 },
      { nombre: 'Cervezas', slug: 'cervezas', orden: 3 },
      { nombre: 'Vinos', slug: 'vinos', orden: 4 },
    ],
  },
  {
    nombre: 'Golosinas',
    slug: 'golosinas',
    orden: 5,
    subcategorias: [
      { nombre: 'Chocolates', slug: 'chocolates', orden: 1 },
      { nombre: 'Galletitas', slug: 'galletitas', orden: 2 },
      { nombre: 'Caramelos', slug: 'caramelos', orden: 3 },
    ],
  },
  {
    nombre: 'Panadería',
    slug: 'panaderia',
    orden: 6,
    subcategorias: [
      { nombre: 'Panes', slug: 'panes', orden: 1 },
      {
        nombre: 'Facturas y medialunas',
        slug: 'facturas-y-medialunas',
        orden: 2,
      },
      { nombre: 'Tortas', slug: 'tortas', orden: 3 },
    ],
  },
  {
    nombre: 'Limpieza',
    slug: 'limpieza',
    orden: 7,
    subcategorias: [
      { nombre: 'Detergentes', slug: 'detergentes', orden: 1 },
      { nombre: 'Limpiadores', slug: 'limpiadores', orden: 2 },
      { nombre: 'Papel higiénico', slug: 'papel-higienico', orden: 3 },
    ],
  },
];

const CONFIG_COMISION_INICIAL_ID = '00000000-0000-4000-8000-000000000001';
const COMISION_MENORCOST_INICIAL = '0.1000'; // 10 %
const PASSWORD_DEMO = 'Password123';

function fechaVencimiento(diasDesdeHoy: number): Date {
  const hoy = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const fecha = new Date(`${hoy}T00:00:00.000Z`);
  fecha.setUTCDate(fecha.getUTCDate() + diasDesdeHoy);
  return fecha;
}

async function seedBase(prisma: PrismaClient): Promise<string> {
  let totalCategorias = 0;
  const rubros: Array<{
    id: string;
    nombre: string;
    slug: string;
    orden: number;
    subcategorias: number;
  }> = [];

  for (const categoria of categorias) {
    const { subcategorias, ...datos } = categoria;
    const rubro = await prisma.categoria.upsert({
      where: { slug: datos.slug },
      update: {
        nombre: datos.nombre,
        orden: datos.orden,
        activa: true,
        categoriaPadreId: null,
      },
      create: {
        ...datos,
        activa: true,
        categoriaPadreId: null,
      },
    });

    totalCategorias += 1;

    for (const subcategoria of subcategorias) {
      await prisma.categoria.upsert({
        where: { slug: subcategoria.slug },
        update: {
          nombre: subcategoria.nombre,
          orden: subcategoria.orden,
          activa: true,
          categoriaPadreId: rubro.idCategoria,
        },
        create: {
          ...subcategoria,
          activa: true,
          categoriaPadreId: rubro.idCategoria,
        },
      });

      totalCategorias += 1;
    }

    rubros.push({
      id: rubro.idCategoria,
      nombre: rubro.nombre,
      slug: rubro.slug,
      orden: rubro.orden,
      subcategorias: subcategorias.length,
    });
  }

  console.log(`Categorías sincronizadas: ${totalCategorias}`);
  console.table(rubros);

  const passwordDemoHash = await hash(PASSWORD_DEMO, 10);
  const clienteDemo = await prisma.usuario.upsert({
    where: {
      email: 'cliente@test.com',
    },
    update: {
      dni: '20123457',
      nombre: 'Cliente',
      apellido: 'Demo',
      telefono: '+54 2901 555556',
      fechaNacimiento: new Date('1995-05-20T00:00:00.000Z'),
      passwordHash: passwordDemoHash,
      rol: 'CLIENTE',
      estado: 'HABILITADO',
      deletedAt: null,
    },
    create: {
      id: '00000000-0000-4000-8000-000000000120',
      dni: '20123457',
      nombre: 'Cliente',
      apellido: 'Demo',
      email: 'cliente@test.com',
      telefono: '+54 2901 555556',
      fechaNacimiento: new Date('1995-05-20T00:00:00.000Z'),
      passwordHash: passwordDemoHash,
      rol: 'CLIENTE',
      estado: 'HABILITADO',
    },
  });

  console.log(`Cliente demo sincronizado: ${clienteDemo.email}`);

  await prisma.direccion.updateMany({
    where: { usuarioId: clienteDemo.id, deletedAt: null },
    data: { esPredeterminada: false },
  });
  await prisma.direccion.upsert({
    where: { id: '00000000-0000-4000-8000-000000000121' },
    update: {
      usuarioId: clienteDemo.id,
      etiqueta: 'Casa',
      calle: 'Avenida San Martín',
      numero: '1200',
      localidad: 'Ushuaia',
      descripcion: 'Dirección de prueba para explorar por cercanía',
        latitud: '-54.808912',
        longitud: '-68.314511',
      esPredeterminada: true,
      deletedAt: null,
    },
    create: {
      id: '00000000-0000-4000-8000-000000000121',
      usuarioId: clienteDemo.id,
      etiqueta: 'Casa',
      calle: 'Avenida San Martín',
      numero: '1200',
      localidad: 'Ushuaia',
      descripcion: 'Dirección de prueba para explorar por cercanía',
        latitud: '-54.808912',
        longitud: '-68.314511',
      esPredeterminada: true,
    },
  });

  const rubrosDemo = await prisma.categoria.findMany({
    where: { activa: true, categoriaPadreId: { not: null } },
    select: { idCategoria: true, slug: true },
  });
  const categoriasPorSlug = new Map(
    rubrosDemo.map((categoria) => [categoria.slug, categoria.idCategoria]),
  );
  const obtenerCategoria = (slug: string): string => {
    const id = categoriasPorSlug.get(slug);
    if (!id) throw new Error(`Falta la subcategoría activa ${slug}`);
    return id;
  };

  const comerciosDemo = [
    {
      id: '00000000-0000-4000-8000-000000000131',
      userId: '00000000-0000-4000-8000-000000000130',
      dni: '20123460',
      email: 'comercio.centro@test.com',
      nombre: 'Comercio Centro',
      apellido: 'Demo',
      nombreFantasia: 'Almacén del Centro',
      razonSocial: 'Almacén del Centro S.R.L.',
      cuit: '30-12345678-1',
      googlePlaceId: 'menorcost-demo-centro',
      numero: '1250',
      calle: 'Avenida San Martin',
      localidad: 'Ushuaia',
      provincia: 'Tierra del Fuego',
      codigoPostal: '9410',
      telefono: '+54 2901 555550',
        latitud: '-54.809052',
        longitud: '-68.315062',
      abierto: true,
    },
    {
      id: '00000000-0000-4000-8000-000000000141',
      userId: '00000000-0000-4000-8000-000000000140',
      dni: '20123461',
      email: 'comercio.barrio@test.com',
      nombre: 'Comercio Barrio',
      apellido: 'Demo',
      nombreFantasia: 'Mercado del Barrio',
      razonSocial: 'Mercado del Barrio S.R.L.',
        cuit: '30-12345679-9',
      googlePlaceId: 'menorcost-demo-barrio',
      calle: 'Kuanip',
        numero: '1294',
      localidad: 'Ushuaia',
      provincia: 'Tierra del Fuego',
      codigoPostal: '9410',
      telefono: '+54 2901 555551',
        latitud: '-54.819377',
        longitud: '-68.342616',
      abierto: false,
    },
  ];

  const comerciosCreados = new Map<string, string>();
  for (const comercio of comerciosDemo) {
    const { id, userId, dni, email, nombre, apellido, ...datosComercio } =
      comercio;
    await prisma.usuario.upsert({
      where: { email },
      update: {
        dni,
        nombre,
        apellido,
        telefono: '+54 2901 555550',
        fechaNacimiento: new Date('1988-04-15T00:00:00.000Z'),
        passwordHash: passwordDemoHash,
        rol: 'COMERCIANTE',
        estado: 'HABILITADO',
        deletedAt: null,
      },
      create: {
        id: userId,
        dni,
        nombre,
        apellido,
        email,
        telefono: '+54 2901 555550',
        fechaNacimiento: new Date('1988-04-15T00:00:00.000Z'),
        passwordHash: passwordDemoHash,
        rol: 'COMERCIANTE',
        estado: 'HABILITADO',
      },
    });

    const comercioCreado = await prisma.comercio.upsert({
      where: { userId },
      update: {
        ...datosComercio,
        estado: 'HABILITADO',
        mercadoPagoVinculado: true,
      },
      create: {
        idComercio: id,
        userId,
        ...datosComercio,
        descripcion: 'Comercio demo para probar búsqueda y exploración.',
        logoUrl: '/uploads/logo-test.png',
        mercadoPagoVinculado: true,
        estado: 'HABILITADO',
      },
    });
    comerciosCreados.set(email, comercioCreado.idComercio);
  }

  const ofertasDemo = [
    {
      id: '00000000-0000-4000-8000-000000000151',
      comercio: 'comercio.centro@test.com',
      categoria: 'aceites-y-conservas',
      titulo: 'Aceite de girasol 900 ml',
      descripcion: 'Oferta de almacén válida hasta hoy inclusive.',
      precioLista: '5000.00',
      precioBaseNeto: '2800.00',
      precioPublico: '3500.00',
      vencimiento: 0,
    },
    {
      id: '00000000-0000-4000-8000-000000000152',
      comercio: 'comercio.centro@test.com',
      categoria: 'leches',
      titulo: 'Leche entera 1 litro',
      descripcion: 'Oferta de lácteos para búsqueda por producto.',
      precioLista: '3200.00',
      precioBaseNeto: '2000.00',
      precioPublico: '2500.00',
      vencimiento: 10,
    },
    {
      id: '00000000-0000-4000-8000-000000000153',
      comercio: 'comercio.barrio@test.com',
      categoria: 'gaseosas',
      titulo: 'Gaseosa cola 2.25 litros',
      descripcion:
        'Oferta en comercio cerrado para probar el filtro operativo.',
      precioLista: '4000.00',
      precioBaseNeto: '2100.00',
      precioPublico: '2800.00',
      vencimiento: 20,
    },
    {
      id: '00000000-0000-4000-8000-000000000154',
      comercio: 'comercio.centro@test.com',
      categoria: 'yogures',
      titulo: 'Yogur de frutilla 190 g',
      descripcion: 'Segunda oferta del mismo local para agrupar marcadores.',
      precioLista: '1800.00',
      precioBaseNeto: '1000.00',
      precioPublico: '1250.00',
      vencimiento: 5,
    },
  ];

  for (const oferta of ofertasDemo) {
    const comercioId = comerciosCreados.get(oferta.comercio);
    if (!comercioId)
      throw new Error(`Falta comercio demo ${oferta.comercio}`);
    await prisma.producto.upsert({
      where: { idProducto: oferta.id },
      update: {
        comercioId,
        categoriaId: obtenerCategoria(oferta.categoria),
        titulo: oferta.titulo,
        descripcion: oferta.descripcion,
        fechaVencimiento: fechaVencimiento(oferta.vencimiento),
        stock: 10,
        precioLista: oferta.precioLista,
        precioBaseNeto: oferta.precioBaseNeto,
        precioPublico: oferta.precioPublico,
        comisionMenorcostTasaAplicada: COMISION_MENORCOST_INICIAL,
        tasaMpEstimadaAplicada: '0.0650',
        imagen: '/uploads/producto-test.png',
        estado: 'ACTIVO',
      },
      create: {
        idProducto: oferta.id,
        comercioId,
        categoriaId: obtenerCategoria(oferta.categoria),
        titulo: oferta.titulo,
        descripcion: oferta.descripcion,
        fechaVencimiento: fechaVencimiento(oferta.vencimiento),
        stock: 10,
        precioLista: oferta.precioLista,
        precioBaseNeto: oferta.precioBaseNeto,
        precioPublico: oferta.precioPublico,
        comisionMenorcostTasaAplicada: COMISION_MENORCOST_INICIAL,
        tasaMpEstimadaAplicada: '0.0650',
        imagen: '/uploads/producto-test.png',
        estado: 'ACTIVO',
      },
    });
  }

  const categoriaVencida = await prisma.categoria.findFirstOrThrow({
    where: { activa: true },
    orderBy: { orden: 'asc' },
  });
  const comercianteVencido = await prisma.usuario.upsert({
    where: { email: 'comerciante-cu207@test.com' },
    update: {
      dni: '20123458',
      nombre: 'Comerciante',
      apellido: 'Demo',
      telefono: '+54 2901 555557',
      fechaNacimiento: new Date('1990-04-15T00:00:00.000Z'),
      passwordHash: passwordDemoHash,
      rol: 'COMERCIANTE',
      estado: 'HABILITADO',
      deletedAt: null,
    },
    create: {
      id: '00000000-0000-4000-8000-000000000201',
      dni: '20123458',
      nombre: 'Comerciante',
      apellido: 'Demo',
      email: 'comerciante-cu207@test.com',
      telefono: '+54 2901 555557',
      fechaNacimiento: new Date('1990-04-15T00:00:00.000Z'),
      passwordHash: passwordDemoHash,
      rol: 'COMERCIANTE',
      estado: 'HABILITADO',
    },
  });
  const comercioVencido = await prisma.comercio.upsert({
    where: { userId: comercianteVencido.id },
    update: {
      nombreFantasia: 'Comercio CU-2.07',
      razonSocial: 'Comercio CU-2.07 S.R.L.',
      descripcion: 'Comercio usado para probar el vencimiento automático.',
      estado: 'HABILITADO',
      mercadoPagoVinculado: true,
      abierto: true,
      calle: 'San Martin',
      numero: '123',
      localidad: 'Ushuaia',
      provincia: 'Tierra del Fuego',
      codigoPostal: '9410',
        latitud: '-54.805139',
        longitud: '-68.300124',
    },
    create: {
      idComercio: '00000000-0000-4000-8000-000000000202',
      userId: comercianteVencido.id,
      mercadoPagoVinculado: true,
      nombreFantasia: 'Comercio CU-2.07',
      razonSocial: 'Comercio CU-2.07 S.R.L.',
        cuit: '30-12345677-3',
      telefono: '+54 2901 555557',
      descripcion: 'Comercio usado para probar el vencimiento automático.',
      calle: 'San Martín',
      numero: '123',
      localidad: 'Ushuaia',
      provincia: 'Tierra del Fuego',
      codigoPostal: '9410',
        latitud: '-54.805139',
        longitud: '-68.300124',
      googlePlaceId: 'cu-207-test-place',
      logoUrl: '/uploads/logo-test.png',
      abierto: true,
      estado: 'HABILITADO',
    },
  });
  const vencidaId = '00000000-0000-4000-8000-000000000203';
  await prisma.notificacion.deleteMany({
    where: { auditoriaVencimiento: { productoId: vencidaId } },
  });
  await prisma.auditoriaVencimientoOferta.deleteMany({
    where: { productoId: vencidaId },
  });
  await prisma.producto.upsert({
    where: { idProducto: vencidaId },
    update: {
      comercioId: comercioVencido.idComercio,
      categoriaId: categoriaVencida.idCategoria,
      titulo: 'Oferta vencida CU-2.07',
      descripcion: 'Oferta creada para probar la depuración automática.',
      fechaVencimiento: fechaVencimiento(-2),
      stock: 5,
      precioLista: '100.00',
      precioBaseNeto: '75.00',
      precioPublico: '88.24',
      comisionMenorcostTasaAplicada: COMISION_MENORCOST_INICIAL,
      tasaMpEstimadaAplicada: '0.0650',
      imagen: '/uploads/producto-test.png',
      estado: 'ACTIVO',
    },
    create: {
      idProducto: vencidaId,
      comercioId: comercioVencido.idComercio,
      categoriaId: categoriaVencida.idCategoria,
      titulo: 'Oferta vencida CU-2.07',
      descripcion: 'Oferta creada para probar la depuración automática.',
      fechaVencimiento: fechaVencimiento(-2),
      stock: 5,
      precioLista: '100.00',
      precioBaseNeto: '75.00',
      precioPublico: '88.24',
      comisionMenorcostTasaAplicada: COMISION_MENORCOST_INICIAL,
      tasaMpEstimadaAplicada: '0.0650',
      imagen: '/uploads/producto-test.png',
      estado: 'ACTIVO',
    },
  });

  console.log(
    'Datos demo para catálogo, cercanía, filtros y búsqueda sincronizados.',
  );
  console.log(`Cliente: ${clienteDemo.email} / ${PASSWORD_DEMO}`);
  console.log(
    'Comercios: comercio.centro@test.com y comercio.barrio@test.com / Password123',
  );
  console.log('Comercio CU-2.07: comerciante-cu207@test.com / Password123');

  const admin = await prisma.usuario.upsert({
          where: { email: 'admin@test.com' },
          update: {
            dni: '20999999',
            nombre: 'Admin',
            apellido: 'Demo',
            telefono: '+54 2901 555555',
            fechaNacimiento: new Date('1990-01-01T00:00:00.000Z'),
            passwordHash: await hash('Password123', 10),
            rol: 'ADMINISTRADOR',
            estado: 'HABILITADO',
            deletedAt: null,
          },
          create: {
            id: '00000000-0000-4000-8000-000000000121',
            dni: '20999999',
            nombre: 'Admin',
            apellido: 'Demo',
            email: 'admin@test.com',
            telefono: '+54 2901 555555',
            fechaNacimiento: new Date('1990-01-01T00:00:00.000Z'),
            passwordHash: await hash('Password123', 10),
            rol: 'ADMINISTRADOR',
            estado: 'HABILITADO',
          },
        });

  console.log(`Administrador demo sincronizado: ${admin.email}`);

  // Garantiza una única configuración activa y carga la tasa inicial (10 %).
  await prisma.configComision.updateMany({
    where: {
      activa: true,
      NOT: { idComision: CONFIG_COMISION_INICIAL_ID },
    },
    data: { activa: false },
  });

  const configComision = await prisma.configComision.upsert({
    where: { idComision: CONFIG_COMISION_INICIAL_ID },
    update: {
      comisionMenorcost: COMISION_MENORCOST_INICIAL,
      activa: true,
    },
    create: {
      idComision: CONFIG_COMISION_INICIAL_ID,
      comisionMenorcost: COMISION_MENORCOST_INICIAL,
      activa: true,
    },
  });

  console.log(
    `Comisión Menorcost activa: ${configComision.comisionMenorcost.toString()}`,
  );

  return admin.id;
}

// ========================================
// Seed backoffice (altas, bajas y denuncias)
// ========================================

const PRODUCTO_DEMO_ID = '00000000-0000-4000-8000-000000000151';
const COMISION_MENORCOST = '0.1000';
const TASA_MP = '0.0650';

const id = (n: number): string =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const fecha = (dias: number): Date =>
  new Date(Date.now() + dias * 24 * 60 * 60 * 1000);

const IDS = {
  USER: {
    altaPendiente1: id(300),
    altaPendiente2: id(301),
    altaRechazada: id(302),
    altaAprobadaReciente: id(303),
    altaAprobadaVieja: id(304),
    bajaClientePendiente: id(310),
    bajaComercioPendiente: id(311),
    bajaBloqueada: id(312),
    bajaAprobada: id(313),
    bajaRechazada: id(314),
    emisorCliente: id(320),
    emisorComercio: id(321),
    denunciadoComercio: id(322),
    denunciadoBajo: id(323),
    denunciadoSancionable: id(324),
    denunciadoCliente: id(325),
  },
  COMERCIO: {
    altaPendiente1: id(400),
    altaPendiente2: id(401),
    altaRechazada: id(402),
    altaAprobadaReciente: id(403),
    altaAprobadaVieja: id(404),
    bajaComercioPendiente: id(410),
    emisorComercio: id(420),
    denunciadoComercio: id(421),
    denunciadoBajo: id(422),
    denunciadoSancionable: id(423),
  },
  PRODUCTO: {
    bajaComercio: id(500),
    denunciadoComercio: id(501),
    denunciadoBajo: id(502),
    denunciadoSancionable: id(503),
    emisorComercio: id(504),
  },
  PEDIDO: {
    bajaEntregado1: id(600),
    bajaEntregado2: id(601),
    bajaBloqueado: id(602),
    denuncia1: id(610),
    denuncia2: id(611),
    denuncia3: id(612),
    denuncia4: id(613),
    denuncia5: id(614),
    denuncia6: id(615),
    denuncia7: id(616),
  },
  BAJA: {
    clientePendiente: id(700),
    comercioPendiente: id(701),
    bloqueada: id(702),
    aprobada: id(703),
    rechazada: id(704),
  },
  DIRECCION: {
    altaPendiente1: id(800),
    altaPendiente2: id(801),
    altaRechazada: id(802),
    altaAprobadaReciente: id(803),
    altaAprobadaVieja: id(804),
  },
} as const;

const SEED_USER_IDS = Object.values(IDS.USER);
const SEED_COMERCIO_IDS = Object.values(IDS.COMERCIO);
const SEED_PRODUCTO_IDS = Object.values(IDS.PRODUCTO);
const SEED_PEDIDO_IDS = Object.values(IDS.PEDIDO);
const SEED_BAJA_IDS = Object.values(IDS.BAJA);

interface UsuarioSeed {
  id: string;
  dni: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  fechaNacimiento: Date;
  rol: Rol;
  estado: EstadoUsuario;
  createdAt: Date;
  deletedAt: Date | null;
}

interface ComercioSeed {
  idComercio: string;
  userId: string;
  nombreFantasia: string;
  razonSocial: string;
  cuit: string;
  telefono: string;
  descripcion: string;
  calle: string;
  numero: string;
  localidad: string;
  provincia: string;
  codigoPostal: string;
  latitud: string;
  longitud: string;
  googlePlaceId: string;
  logoUrl: string;
  abierto: boolean;
  estado: EstadoComercio;
  resueltoPorId?: string | null;
  resueltoEn?: Date | null;
  motivoRechazo?: string | null;
  mercadoPagoVinculado: boolean;
  reputacionPromedio: number;
  totalCalificaciones: number;
}

interface ProductoSeed {
  idProducto: string;
  comercioId: string;
  categoriaSlug: string;
  titulo: string;
  descripcion: string;
  fechaVencimiento: Date;
  stock: number;
  precioLista: string;
  precioBaseNeto: string;
  precioPublico: string;
  estado: EstadoProducto;
  pausadoPorBaja: boolean;
}

interface PedidoSeed {
  idPedido: string;
  nroPedido: string;
  codigoQR: string;
  codigoAlfanumerico: string;
  usuarioId: string;
  comercioId: string;
  productoId: string;
  tituloProducto: string;
  fechaVencimientoProducto: Date;
  estado: EstadoPedido;
  fechaPedido: Date;
  cantidad: number;
  precioUnitario: string;
  precioBaseNeto: string;
  comision: string;
  subtotal: string;
  tarifaServicio: string;
  total: string;
}

interface BajaSeed {
  id: string;
  usuarioId: string;
  motivo: string;
  estado: EstadoSolicitudBaja;
  estadoPrevioUsuario: EstadoUsuario;
  observaciones: string | null;
  resueltoPorId: string | null;
  resueltoEn: Date | null;
  createdAt: Date;
}

interface ReporteSeed {
  idPedido: string;
  idEmisor: string;
  idDenunciado: string;
  tipoDestino: TipoDestinoReporte;
  motivo: string;
  motivoCodigo: MotivoReporte;
  descripcion: string;
  estado: EstadoReporte;
  fechaReporte: Date;
  idAdmin: string | null;
  fechaResolucion: Date | null;
}

const usuarios: UsuarioSeed[] = [
  {
    id: IDS.USER.altaPendiente1,
    dni: '30000001',
    nombre: 'Alta',
    apellido: 'Pendiente Uno',
    email: 'bo.alta.pendiente1@test.com',
    telefono: '+54 2901 600001',
    fechaNacimiento: new Date('1990-01-01T00:00:00.000Z'),
    rol: 'COMERCIANTE',
    estado: 'PENDIENTE_VERIFICACION',
    createdAt: fecha(-2),
    deletedAt: null,
  },
  {
    id: IDS.USER.altaPendiente2,
    dni: '30000002',
    nombre: 'Alta',
    apellido: 'Pendiente Dos',
    email: 'bo.alta.pendiente2@test.com',
    telefono: '+54 2901 600002',
    fechaNacimiento: new Date('1991-02-02T00:00:00.000Z'),
    rol: 'COMERCIANTE',
    estado: 'PENDIENTE_VERIFICACION',
    createdAt: fecha(-5),
    deletedAt: null,
  },
  {
    id: IDS.USER.altaRechazada,
    dni: '30000003',
    nombre: 'Alta',
    apellido: 'Rechazada',
    email: 'bo.alta.rechazada@test.com',
    telefono: '+54 2901 600003',
    fechaNacimiento: new Date('1992-03-03T00:00:00.000Z'),
    rol: 'COMERCIANTE',
    estado: 'DOCUMENTACION_RECHAZADA',
    createdAt: fecha(-10),
    deletedAt: null,
  },
  {
    id: IDS.USER.altaAprobadaReciente,
    dni: '30000004',
    nombre: 'Alta',
    apellido: 'Aprobada Reciente',
    email: 'bo.alta.aprobada.reciente@test.com',
    telefono: '+54 2901 600004',
    fechaNacimiento: new Date('1993-04-04T00:00:00.000Z'),
    rol: 'COMERCIANTE',
    estado: 'HABILITADO',
    createdAt: fecha(-20),
    deletedAt: null,
  },
  {
    id: IDS.USER.altaAprobadaVieja,
    dni: '30000005',
    nombre: 'Alta',
    apellido: 'Aprobada Vieja',
    email: 'bo.alta.aprobada.vieja@test.com',
    telefono: '+54 2901 600005',
    fechaNacimiento: new Date('1994-05-05T00:00:00.000Z'),
    rol: 'COMERCIANTE',
    estado: 'HABILITADO',
    createdAt: fecha(-45),
    deletedAt: null,
  },
  {
    id: IDS.USER.bajaClientePendiente,
    dni: '31000001',
    nombre: 'Baja',
    apellido: 'Cliente Pendiente',
    email: 'bo.baja.cliente.pendiente@test.com',
    telefono: '+54 2901 610001',
    fechaNacimiento: new Date('1995-06-06T00:00:00.000Z'),
    rol: 'CLIENTE',
    estado: 'SOLICITUD_BAJA_PENDIENTE',
    createdAt: fecha(-60),
    deletedAt: null,
  },
  {
    id: IDS.USER.bajaComercioPendiente,
    dni: '31000002',
    nombre: 'Baja',
    apellido: 'Comercio Pendiente',
    email: 'bo.baja.comercio.pendiente@test.com',
    telefono: '+54 2901 610002',
    fechaNacimiento: new Date('1996-07-07T00:00:00.000Z'),
    rol: 'COMERCIANTE',
    estado: 'SOLICITUD_BAJA_PENDIENTE',
    createdAt: fecha(-80),
    deletedAt: null,
  },
  {
    id: IDS.USER.bajaBloqueada,
    dni: '31000003',
    nombre: 'Baja',
    apellido: 'Bloqueada',
    email: 'bo.baja.bloqueada@test.com',
    telefono: '+54 2901 610003',
    fechaNacimiento: new Date('1997-08-08T00:00:00.000Z'),
    rol: 'CLIENTE',
    estado: 'SOLICITUD_BAJA_PENDIENTE',
    createdAt: fecha(-40),
    deletedAt: null,
  },
  {
    id: IDS.USER.bajaAprobada,
    dni: '31000004',
    nombre: 'Baja',
    apellido: 'Aprobada',
    email: 'bo.baja.aprobada@test.com',
    telefono: '+54 2901 610004',
    fechaNacimiento: new Date('1998-09-09T00:00:00.000Z'),
    rol: 'CLIENTE',
    estado: 'SOLICITUD_BAJA_PENDIENTE',
    createdAt: fecha(-100),
    deletedAt: fecha(-3),
  },
  {
    id: IDS.USER.bajaRechazada,
    dni: '31000005',
    nombre: 'Baja',
    apellido: 'Rechazada',
    email: 'bo.baja.rechazada@test.com',
    telefono: '+54 2901 610005',
    fechaNacimiento: new Date('1999-10-10T00:00:00.000Z'),
    rol: 'CLIENTE',
    estado: 'HABILITADO',
    createdAt: fecha(-90),
    deletedAt: null,
  },
  {
    id: IDS.USER.emisorCliente,
    dni: '32000001',
    nombre: 'Emisor',
    apellido: 'Cliente',
    email: 'bo.denuncia.emisor.cliente@test.com',
    telefono: '+54 2901 620001',
    fechaNacimiento: new Date('1990-11-11T00:00:00.000Z'),
    rol: 'CLIENTE',
    estado: 'HABILITADO',
    createdAt: fecha(-120),
    deletedAt: null,
  },
  {
    id: IDS.USER.emisorComercio,
    dni: '32000002',
    nombre: 'Emisor',
    apellido: 'Comercio',
    email: 'bo.denuncia.emisor.comercio@test.com',
    telefono: '+54 2901 620002',
    fechaNacimiento: new Date('1991-12-12T00:00:00.000Z'),
    rol: 'COMERCIANTE',
    estado: 'HABILITADO',
    createdAt: fecha(-120),
    deletedAt: null,
  },
  {
    id: IDS.USER.denunciadoComercio,
    dni: '32000003',
    nombre: 'Denunciado',
    apellido: 'Comercio',
    email: 'bo.denuncia.denunciado.comercio@test.com',
    telefono: '+54 2901 620003',
    fechaNacimiento: new Date('1992-01-13T00:00:00.000Z'),
    rol: 'COMERCIANTE',
    estado: 'HABILITADO',
    createdAt: fecha(-120),
    deletedAt: null,
  },
  {
    id: IDS.USER.denunciadoBajo,
    dni: '32000004',
    nombre: 'Denunciado',
    apellido: 'Bajo Investigación',
    email: 'bo.denuncia.denunciado.bajo@test.com',
    telefono: '+54 2901 620004',
    fechaNacimiento: new Date('1993-02-14T00:00:00.000Z'),
    rol: 'COMERCIANTE',
    estado: 'BAJO_INVESTIGACION',
    createdAt: fecha(-120),
    deletedAt: null,
  },
  {
    id: IDS.USER.denunciadoSancionable,
    dni: '32000005',
    nombre: 'Denunciado',
    apellido: 'Sancionable',
    email: 'bo.denuncia.denunciado.sancionable@test.com',
    telefono: '+54 2901 620005',
    fechaNacimiento: new Date('1994-03-15T00:00:00.000Z'),
    rol: 'COMERCIANTE',
    estado: 'HABILITADO',
    createdAt: fecha(-120),
    deletedAt: null,
  },
  {
    id: IDS.USER.denunciadoCliente,
    dni: '32000006',
    nombre: 'Denunciado',
    apellido: 'Cliente',
    email: 'bo.denuncia.denunciado.cliente@test.com',
    telefono: '+54 2901 620006',
    fechaNacimiento: new Date('1995-04-16T00:00:00.000Z'),
    rol: 'CLIENTE',
    estado: 'HABILITADO',
    createdAt: fecha(-120),
    deletedAt: null,
  },
];

const comercios: ComercioSeed[] = [
  {
    idComercio: IDS.COMERCIO.altaPendiente1,
    userId: IDS.USER.altaPendiente1,
    nombreFantasia: 'Almacén Pendiente Uno',
    razonSocial: 'Alta Pendiente Uno S.R.L.',
    cuit: '30-90000001-0',
    telefono: '+54 2901 600001',
    descripcion: 'Comercio pendiente para probar la aprobación de altas.',
    calle: 'San Martín',
    numero: '1001',
    localidad: 'Ushuaia',
    provincia: 'Tierra del Fuego',
    codigoPostal: '9410',
    latitud: '-54.808144',
    longitud: '-68.311948',
    googlePlaceId: 'bo-alta-pendiente-1',
    logoUrl: '/uploads/logo-test.png',
    abierto: false,
    estado: 'PENDIENTE_VERIFICACION',
    mercadoPagoVinculado: true,
    reputacionPromedio: 4.5,
    totalCalificaciones: 12,
  },
  {
    idComercio: IDS.COMERCIO.altaPendiente2,
    userId: IDS.USER.altaPendiente2,
    nombreFantasia: 'Mercado Pendiente Dos',
    razonSocial: 'Alta Pendiente Dos S.R.L.',
    cuit: '30-90000002-9',
    telefono: '+54 2901 600002',
    descripcion: 'Comercio pendiente sin Mercado Pago para probar el rechazo.',
    calle: 'Kuanip',
    numero: '1002',
    localidad: 'Ushuaia',
    provincia: 'Tierra del Fuego',
    codigoPostal: '9410',
    latitud: '-54.818471',
    longitud: '-68.339811',
    googlePlaceId: 'bo-alta-pendiente-2',
    logoUrl: '/uploads/logo-test.png',
    abierto: false,
    estado: 'PENDIENTE_VERIFICACION',
    mercadoPagoVinculado: false,
    reputacionPromedio: 0,
    totalCalificaciones: 0,
  },
  {
    idComercio: IDS.COMERCIO.altaRechazada,
    userId: IDS.USER.altaRechazada,
    nombreFantasia: 'Comercio Rechazado',
    razonSocial: 'Alta Rechazada S.R.L.',
    cuit: '30-90000003-7',
    telefono: '+54 2901 600003',
    descripcion: 'Comercio con documentación rechazada para probar filtros.',
    calle: 'Gobernador Paz',
    numero: '1003',
    localidad: 'Ushuaia',
    provincia: 'Tierra del Fuego',
    codigoPostal: '9410',
    latitud: '-54.812443',
    longitud: '-68.330813',
    googlePlaceId: 'bo-alta-rechazada',
    logoUrl: '/uploads/logo-test.png',
    abierto: false,
    estado: 'DOCUMENTACION_RECHAZADA',
    resueltoEn: fecha(-7),
    motivoRechazo:
      'La constancia de CUIT no coincide con la razón social declarada.',
    mercadoPagoVinculado: false,
    reputacionPromedio: 0,
    totalCalificaciones: 0,
  },
  {
    idComercio: IDS.COMERCIO.altaAprobadaReciente,
    userId: IDS.USER.altaAprobadaReciente,
    nombreFantasia: 'Comercio Aprobado Reciente',
    razonSocial: 'Alta Aprobada Reciente S.R.L.',
    cuit: '30-90000004-5',
    telefono: '+54 2901 600004',
    descripcion: 'Comercio habilitado dentro de la ventana de 30 días.',
    calle: 'Malvinas Argentinas',
    numero: '1004',
    localidad: 'Ushuaia',
    provincia: 'Tierra del Fuego',
    codigoPostal: '9410',
    latitud: '-54.818744',
    longitud: '-68.323859',
    googlePlaceId: 'bo-alta-aprobada-reciente',
    logoUrl: '/uploads/logo-test.png',
    abierto: true,
    estado: 'HABILITADO',
    resueltoEn: fecha(-18),
    motivoRechazo: null,
    mercadoPagoVinculado: true,
    reputacionPromedio: 4.8,
    totalCalificaciones: 25,
  },
  {
    idComercio: IDS.COMERCIO.altaAprobadaVieja,
    userId: IDS.USER.altaAprobadaVieja,
    nombreFantasia: 'Comercio Aprobado Viejo',
    razonSocial: 'Alta Aprobada Vieja S.R.L.',
    cuit: '30-90000005-3',
    telefono: '+54 2901 600005',
    descripcion: 'Comercio habilitado fuera de la ventana de 30 días.',
    calle: 'Ruta 3',
    numero: '1005',
    localidad: 'Ushuaia',
    provincia: 'Tierra del Fuego',
    codigoPostal: '9410',
    latitud: '-54.788253',
    longitud: '-68.225185',
    googlePlaceId: 'bo-alta-aprobada-vieja',
    logoUrl: '/uploads/logo-test.png',
    abierto: true,
    estado: 'HABILITADO',
    resueltoEn: fecha(-40),
    motivoRechazo: null,
    mercadoPagoVinculado: true,
    reputacionPromedio: 4.2,
    totalCalificaciones: 8,
  },
  {
    idComercio: IDS.COMERCIO.bajaComercioPendiente,
    userId: IDS.USER.bajaComercioPendiente,
    nombreFantasia: 'Comercio Baja Pendiente',
    razonSocial: 'Baja Comercio Pendiente S.R.L.',
    cuit: '30-90000010-9',
    telefono: '+54 2901 610002',
    descripcion: 'Comercio con baja pendiente y ofertas pausadas por la baja.',
    calle: 'Arturo Coronado',
    numero: '486',
    localidad: 'Ushuaia',
    provincia: 'Tierra del Fuego',
    codigoPostal: '9410',
    latitud: '-54.814095',
    longitud: '-68.336300',
    googlePlaceId: 'bo-baja-comercio-pendiente',
    logoUrl: '/uploads/logo-test.png',
    abierto: true,
    estado: 'HABILITADO',
    mercadoPagoVinculado: true,
    reputacionPromedio: 4.1,
    totalCalificaciones: 10,
  },
  {
    idComercio: IDS.COMERCIO.emisorComercio,
    userId: IDS.USER.emisorComercio,
    nombreFantasia: 'Comercio Emisor',
    razonSocial: 'Emisor Comercio S.R.L.',
    cuit: '30-90000020-7',
    telefono: '+54 2901 620002',
    descripcion: 'Comercio que denuncia a un cliente.',
    calle: 'San Martín',
    numero: '1020',
    localidad: 'Ushuaia',
    provincia: 'Tierra del Fuego',
    codigoPostal: '9410',
    latitud: '-54.808293',
    longitud: '-68.312067',
    googlePlaceId: 'bo-emisor-comercio',
    logoUrl: '/uploads/logo-test.png',
    abierto: true,
    estado: 'HABILITADO',
    mercadoPagoVinculado: true,
    reputacionPromedio: 4.6,
    totalCalificaciones: 18,
  },
  {
    idComercio: IDS.COMERCIO.denunciadoComercio,
    userId: IDS.USER.denunciadoComercio,
    nombreFantasia: 'Comercio Denunciado',
    razonSocial: 'Denunciado Comercio S.R.L.',
    cuit: '30-90000021-5',
    telefono: '+54 2901 620003',
    descripcion: 'Comercio con reportes abiertos, resueltos y desestimados.',
    calle: 'Kuanip',
    numero: '1021',
    localidad: 'Ushuaia',
    provincia: 'Tierra del Fuego',
    codigoPostal: '9410',
    latitud: '-54.818364',
    longitud: '-68.340043',
    googlePlaceId: 'bo-denunciado-comercio',
    logoUrl: '/uploads/logo-test.png',
    abierto: true,
    estado: 'HABILITADO',
    mercadoPagoVinculado: true,
    reputacionPromedio: 3.9,
    totalCalificaciones: 14,
  },
  {
    idComercio: IDS.COMERCIO.denunciadoBajo,
    userId: IDS.USER.denunciadoBajo,
    nombreFantasia: 'Comercio Bajo Investigación',
    razonSocial: 'Denunciado Bajo Investigación S.R.L.',
    cuit: '30-90000022-3',
    telefono: '+54 2901 620004',
    descripcion: 'Comercio bajo investigación con un único reporte abierto.',
    calle: 'Gobernador Paz',
    numero: '1022',
    localidad: 'Ushuaia',
    provincia: 'Tierra del Fuego',
    codigoPostal: '9410',
    latitud: '-54.806742',
    longitud: '-68.313255',
    googlePlaceId: 'bo-denunciado-bajo',
    logoUrl: '/uploads/logo-test.png',
    abierto: true,
    estado: 'HABILITADO',
    mercadoPagoVinculado: true,
    reputacionPromedio: 4,
    totalCalificaciones: 9,
  },
  {
    idComercio: IDS.COMERCIO.denunciadoSancionable,
    userId: IDS.USER.denunciadoSancionable,
    nombreFantasia: 'Comercio Sancionable',
    razonSocial: 'Denunciado Sancionable S.R.L.',
    cuit: '30-90000023-1',
    telefono: '+54 2901 620005',
    descripcion: 'Comercio con dos reportes abiertos para probar la sanción.',
    calle: 'Malvinas Argentinas',
    numero: '1023',
    localidad: 'Ushuaia',
    provincia: 'Tierra del Fuego',
    codigoPostal: '9410',
    latitud: '-54.815585',
    longitud: '-68.322859',
    googlePlaceId: 'bo-denunciado-sancionable',
    logoUrl: '/uploads/logo-test.png',
    abierto: true,
    estado: 'HABILITADO',
    mercadoPagoVinculado: true,
    reputacionPromedio: 3.7,
    totalCalificaciones: 21,
  },
];

const productos: ProductoSeed[] = [
  {
    idProducto: IDS.PRODUCTO.bajaComercio,
    comercioId: IDS.COMERCIO.bajaComercioPendiente,
    categoriaSlug: 'aceites-y-conservas',
    titulo: 'Aceite de prueba para baja',
    descripcion: 'Oferta pausada por la solicitud de baja del comercio.',
    fechaVencimiento: fecha(15),
    stock: 10,
    precioLista: '1000.00',
    precioBaseNeto: '700.00',
    precioPublico: '800.00',
    estado: 'PAUSADO',
    pausadoPorBaja: true,
  },
  {
    idProducto: IDS.PRODUCTO.denunciadoComercio,
    comercioId: IDS.COMERCIO.denunciadoComercio,
    categoriaSlug: 'leches',
    titulo: 'Leche del comercio denunciado',
    descripcion: 'Producto usado en pedidos con reportes.',
    fechaVencimiento: fecha(15),
    stock: 10,
    precioLista: '1200.00',
    precioBaseNeto: '800.00',
    precioPublico: '900.00',
    estado: 'PAUSADO',
    pausadoPorBaja: false,
  },
  {
    idProducto: IDS.PRODUCTO.denunciadoBajo,
    comercioId: IDS.COMERCIO.denunciadoBajo,
    categoriaSlug: 'gaseosas',
    titulo: 'Gaseosa del comercio bajo investigación',
    descripcion: 'Producto usado en un pedido con reporte abierto.',
    fechaVencimiento: fecha(15),
    stock: 10,
    precioLista: '1500.00',
    precioBaseNeto: '900.00',
    precioPublico: '1000.00',
    estado: 'PAUSADO',
    pausadoPorBaja: false,
  },
  {
    idProducto: IDS.PRODUCTO.denunciadoSancionable,
    comercioId: IDS.COMERCIO.denunciadoSancionable,
    categoriaSlug: 'yogures',
    titulo: 'Yogur del comercio sancionable',
    descripcion: 'Producto usado en dos pedidos con reportes abiertos.',
    fechaVencimiento: fecha(15),
    stock: 10,
    precioLista: '900.00',
    precioBaseNeto: '600.00',
    precioPublico: '700.00',
    estado: 'PAUSADO',
    pausadoPorBaja: false,
  },
  {
    idProducto: IDS.PRODUCTO.emisorComercio,
    comercioId: IDS.COMERCIO.emisorComercio,
    categoriaSlug: 'aceites-y-conservas',
    titulo: 'Producto del comercio emisor',
    descripcion: 'Producto usado en un pedido denunciado por el comercio.',
    fechaVencimiento: fecha(15),
    stock: 10,
    precioLista: '1300.00',
    precioBaseNeto: '850.00',
    precioPublico: '950.00',
    estado: 'PAUSADO',
    pausadoPorBaja: false,
  },
];

const pedidos: PedidoSeed[] = [
  {
    idPedido: IDS.PEDIDO.bajaEntregado1,
    nroPedido: 'BO-PED-0001',
    codigoQR: 'BO-QR-0001',
    codigoAlfanumerico: 'BO0001',
    usuarioId: IDS.USER.bajaClientePendiente,
    comercioId: IDS.COMERCIO.bajaComercioPendiente,
    productoId: IDS.PRODUCTO.bajaComercio,
    tituloProducto: 'Aceite de prueba para baja',
    fechaVencimientoProducto: fecha(15),
    estado: 'ENTREGADO',
    fechaPedido: fecha(-10),
    cantidad: 1,
    precioUnitario: '800.00',
    precioBaseNeto: '700.00',
    comision: '80.00',
    subtotal: '800.00',
    tarifaServicio: '80.00',
    total: '800.00',
  },
  {
    idPedido: IDS.PEDIDO.bajaEntregado2,
    nroPedido: 'BO-PED-0002',
    codigoQR: 'BO-QR-0002',
    codigoAlfanumerico: 'BO0002',
    usuarioId: IDS.USER.bajaClientePendiente,
    comercioId: IDS.COMERCIO.bajaComercioPendiente,
    productoId: IDS.PRODUCTO.bajaComercio,
    tituloProducto: 'Aceite de prueba para baja',
    fechaVencimientoProducto: fecha(15),
    estado: 'ENTREGADO',
    fechaPedido: fecha(-8),
    cantidad: 1,
    precioUnitario: '800.00',
    precioBaseNeto: '700.00',
    comision: '80.00',
    subtotal: '800.00',
    tarifaServicio: '80.00',
    total: '800.00',
  },
  {
    idPedido: IDS.PEDIDO.denuncia1,
    nroPedido: 'BO-PED-0010',
    codigoQR: 'BO-QR-0010',
    codigoAlfanumerico: 'BO0010',
    usuarioId: IDS.USER.emisorCliente,
    comercioId: IDS.COMERCIO.denunciadoComercio,
    productoId: IDS.PRODUCTO.denunciadoComercio,
    tituloProducto: 'Leche del comercio denunciado',
    fechaVencimientoProducto: fecha(15),
    estado: 'ENTREGADO',
    fechaPedido: fecha(-5),
    cantidad: 1,
    precioUnitario: '900.00',
    precioBaseNeto: '800.00',
    comision: '90.00',
    subtotal: '900.00',
    tarifaServicio: '90.00',
    total: '900.00',
  },
  {
    idPedido: IDS.PEDIDO.denuncia2,
    nroPedido: 'BO-PED-0011',
    codigoQR: 'BO-QR-0011',
    codigoAlfanumerico: 'BO0011',
    usuarioId: IDS.USER.emisorCliente,
    comercioId: IDS.COMERCIO.denunciadoBajo,
    productoId: IDS.PRODUCTO.denunciadoBajo,
    tituloProducto: 'Gaseosa del comercio bajo investigación',
    fechaVencimientoProducto: fecha(15),
    estado: 'ENTREGADO',
    fechaPedido: fecha(-4),
    cantidad: 1,
    precioUnitario: '1000.00',
    precioBaseNeto: '900.00',
    comision: '100.00',
    subtotal: '1000.00',
    tarifaServicio: '100.00',
    total: '1000.00',
  },
  {
    idPedido: IDS.PEDIDO.denuncia3,
    nroPedido: 'BO-PED-0012',
    codigoQR: 'BO-QR-0012',
    codigoAlfanumerico: 'BO0012',
    usuarioId: IDS.USER.emisorCliente,
    comercioId: IDS.COMERCIO.denunciadoSancionable,
    productoId: IDS.PRODUCTO.denunciadoSancionable,
    tituloProducto: 'Yogur del comercio sancionable',
    fechaVencimientoProducto: fecha(15),
    estado: 'ENTREGADO',
    fechaPedido: fecha(-3),
    cantidad: 1,
    precioUnitario: '700.00',
    precioBaseNeto: '600.00',
    comision: '70.00',
    subtotal: '700.00',
    tarifaServicio: '70.00',
    total: '700.00',
  },
  {
    idPedido: IDS.PEDIDO.denuncia4,
    nroPedido: 'BO-PED-0013',
    codigoQR: 'BO-QR-0013',
    codigoAlfanumerico: 'BO0013',
    usuarioId: IDS.USER.emisorCliente,
    comercioId: IDS.COMERCIO.denunciadoSancionable,
    productoId: IDS.PRODUCTO.denunciadoSancionable,
    tituloProducto: 'Yogur del comercio sancionable',
    fechaVencimientoProducto: fecha(15),
    estado: 'ENTREGADO',
    fechaPedido: fecha(-2),
    cantidad: 1,
    precioUnitario: '700.00',
    precioBaseNeto: '600.00',
    comision: '70.00',
    subtotal: '700.00',
    tarifaServicio: '70.00',
    total: '700.00',
  },
  {
    idPedido: IDS.PEDIDO.denuncia5,
    nroPedido: 'BO-PED-0014',
    codigoQR: 'BO-QR-0014',
    codigoAlfanumerico: 'BO0014',
    usuarioId: IDS.USER.emisorCliente,
    comercioId: IDS.COMERCIO.denunciadoComercio,
    productoId: IDS.PRODUCTO.denunciadoComercio,
    tituloProducto: 'Leche del comercio denunciado',
    fechaVencimientoProducto: fecha(15),
    estado: 'ENTREGADO',
    fechaPedido: fecha(-14),
    cantidad: 1,
    precioUnitario: '900.00',
    precioBaseNeto: '800.00',
    comision: '90.00',
    subtotal: '900.00',
    tarifaServicio: '90.00',
    total: '900.00',
  },
  {
    idPedido: IDS.PEDIDO.denuncia6,
    nroPedido: 'BO-PED-0015',
    codigoQR: 'BO-QR-0015',
    codigoAlfanumerico: 'BO0015',
    usuarioId: IDS.USER.emisorCliente,
    comercioId: IDS.COMERCIO.denunciadoComercio,
    productoId: IDS.PRODUCTO.denunciadoComercio,
    tituloProducto: 'Leche del comercio denunciado',
    fechaVencimientoProducto: fecha(15),
    estado: 'ENTREGADO',
    fechaPedido: fecha(-17),
    cantidad: 1,
    precioUnitario: '900.00',
    precioBaseNeto: '800.00',
    comision: '90.00',
    subtotal: '900.00',
    tarifaServicio: '90.00',
    total: '900.00',
  },
  {
    idPedido: IDS.PEDIDO.denuncia7,
    nroPedido: 'BO-PED-0016',
    codigoQR: 'BO-QR-0016',
    codigoAlfanumerico: 'BO0016',
    usuarioId: IDS.USER.denunciadoCliente,
    comercioId: IDS.COMERCIO.emisorComercio,
    productoId: IDS.PRODUCTO.emisorComercio,
    tituloProducto: 'Producto del comercio emisor',
    fechaVencimientoProducto: fecha(15),
    estado: 'CANCELADO_POR_FALTA_RETIRO',
    fechaPedido: fecha(-6),
    cantidad: 1,
    precioUnitario: '950.00',
    precioBaseNeto: '850.00',
    comision: '95.00',
    subtotal: '950.00',
    tarifaServicio: '95.00',
    total: '950.00',
  },
];

const bajas: BajaSeed[] = [
  {
    id: IDS.BAJA.clientePendiente,
    usuarioId: IDS.USER.bajaClientePendiente,
    motivo: 'Ya no uso la plataforma',
    estado: 'PENDIENTE',
    estadoPrevioUsuario: 'HABILITADO',
    observaciones: null,
    resueltoPorId: null,
    resueltoEn: null,
    createdAt: fecha(-1),
  },
  {
    id: IDS.BAJA.comercioPendiente,
    usuarioId: IDS.USER.bajaComercioPendiente,
    motivo: 'Cierro el local',
    estado: 'PENDIENTE',
    estadoPrevioUsuario: 'HABILITADO',
    observaciones: null,
    resueltoPorId: null,
    resueltoEn: null,
    createdAt: fecha(-2),
  },
  {
    id: IDS.BAJA.bloqueada,
    usuarioId: IDS.USER.bajaBloqueada,
    motivo: 'Cambio de cuenta',
    estado: 'PENDIENTE',
    estadoPrevioUsuario: 'HABILITADO',
    observaciones: null,
    resueltoPorId: null,
    resueltoEn: null,
    createdAt: fecha(-1),
  },
  {
    id: IDS.BAJA.aprobada,
    usuarioId: IDS.USER.bajaAprobada,
    motivo: 'Ya no la necesito',
    estado: 'APROBADA',
    estadoPrevioUsuario: 'HABILITADO',
    observaciones: null,
    resueltoPorId: null,
    resueltoEn: fecha(-3),
    createdAt: fecha(-5),
  },
  {
    id: IDS.BAJA.rechazada,
    usuarioId: IDS.USER.bajaRechazada,
    motivo: 'Quiero darme de baja',
    estado: 'RECHAZADA',
    estadoPrevioUsuario: 'HABILITADO',
    observaciones: 'Tenés un pedido pendiente de retiro.',
    resueltoPorId: null,
    resueltoEn: fecha(-2),
    createdAt: fecha(-4),
  },
];

const reportes: ReporteSeed[] = [
  {
    idPedido: IDS.PEDIDO.denuncia1,
    idEmisor: IDS.USER.emisorCliente,
    idDenunciado: IDS.USER.denunciadoComercio,
    tipoDestino: 'COMERCIO',
    motivo: 'El producto estaba en mal estado/era diferente',
    motivoCodigo: 'PRODUCTO_MAL_ESTADO',
    descripcion: 'El producto llegó vencido.',
    estado: 'PENDIENTE_REVISION',
    fechaReporte: fecha(-4),
    idAdmin: null,
    fechaResolucion: null,
  },
  {
    idPedido: IDS.PEDIDO.denuncia2,
    idEmisor: IDS.USER.emisorCliente,
    idDenunciado: IDS.USER.denunciadoBajo,
    tipoDestino: 'COMERCIO',
    motivo: 'El comercio estaba cerrado al ir a retirar',
    motivoCodigo: 'COMERCIO_CERRADO',
    descripcion: 'El comercio estaba cerrado en el horario publicado.',
    estado: 'BAJO_INVESTIGACION',
    fechaReporte: fecha(-3),
    idAdmin: null,
    fechaResolucion: null,
  },
  {
    idPedido: IDS.PEDIDO.denuncia3,
    idEmisor: IDS.USER.emisorCliente,
    idDenunciado: IDS.USER.denunciadoSancionable,
    tipoDestino: 'COMERCIO',
    motivo: 'El comercio no respetó el precio',
    motivoCodigo: 'PRECIO_NO_RESPETADO',
    descripcion: 'Se cobró un importe distinto al publicado.',
    estado: 'PENDIENTE_REVISION',
    fechaReporte: fecha(-2),
    idAdmin: null,
    fechaResolucion: null,
  },
  {
    idPedido: IDS.PEDIDO.denuncia4,
    idEmisor: IDS.USER.emisorCliente,
    idDenunciado: IDS.USER.denunciadoSancionable,
    tipoDestino: 'COMERCIO',
    motivo: 'El producto estaba en mal estado/era diferente',
    motivoCodigo: 'PRODUCTO_MAL_ESTADO',
    descripcion: 'El pedido incluía un producto vencido.',
    estado: 'PENDIENTE_REVISION',
    fechaReporte: fecha(-2),
    idAdmin: null,
    fechaResolucion: null,
  },
  {
    idPedido: IDS.PEDIDO.denuncia5,
    idEmisor: IDS.USER.emisorCliente,
    idDenunciado: IDS.USER.denunciadoComercio,
    tipoDestino: 'COMERCIO',
    motivo: 'Otro motivo',
    motivoCodigo: 'OTRO',
    descripcion: 'El pedido se entregó fuera de la franja acordada.',
    estado: 'RESUELTO',
    fechaReporte: fecha(-12),
    idAdmin: null,
    fechaResolucion: fecha(-10),
  },
  {
    idPedido: IDS.PEDIDO.denuncia6,
    idEmisor: IDS.USER.emisorCliente,
    idDenunciado: IDS.USER.denunciadoComercio,
    tipoDestino: 'COMERCIO',
    motivo: 'Otro motivo',
    motivoCodigo: 'OTRO',
    descripcion: 'El comercio no respondió los mensajes.',
    estado: 'DESESTIMADO',
    fechaReporte: fecha(-15),
    idAdmin: null,
    fechaResolucion: fecha(-13),
  },
  {
    idPedido: IDS.PEDIDO.denuncia7,
    idEmisor: IDS.USER.emisorComercio,
    idDenunciado: IDS.USER.denunciadoCliente,
    tipoDestino: 'CLIENTE',
    motivo: 'El cliente no se presentó a retirar el producto',
    motivoCodigo: 'CLIENTE_NO_RETIRO',
    descripcion: 'El cliente no retiró el pedido en la franja indicada.',
    estado: 'PENDIENTE_REVISION',
    fechaReporte: fecha(-1),
    idAdmin: null,
    fechaResolucion: null,
  },
];

async function limpiarSeed(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.notificacion.deleteMany({
      where: { usuarioId: { in: SEED_USER_IDS } },
    });
    await tx.calificacion.deleteMany({
      where: { id_pedido: { in: SEED_PEDIDO_IDS } },
    });
    await tx.reporte.deleteMany({
      where: {
        OR: [
          { id_pedido: { in: SEED_PEDIDO_IDS } },
          { id_emisor: { in: SEED_USER_IDS } },
          { id_denunciado: { in: SEED_USER_IDS } },
        ],
      },
    });
    await tx.pago.deleteMany({
      where: { pedidoId: { in: SEED_PEDIDO_IDS } },
    });
    await tx.pedidoItem.deleteMany({
      where: { pedidoId: { in: SEED_PEDIDO_IDS } },
    });
    await tx.pedido.deleteMany({
      where: { id_pedido: { in: SEED_PEDIDO_IDS } },
    });
    await tx.solicitudBaja.deleteMany({
      where: {
        OR: [
          { id: { in: SEED_BAJA_IDS } },
          { usuarioId: { in: SEED_USER_IDS } },
        ],
      },
    });
    await tx.canasta.deleteMany({
      where: {
        OR: [
          { usuarioId: { in: SEED_USER_IDS } },
          { comercioId: { in: SEED_COMERCIO_IDS } },
        ],
      },
    });
    await tx.credencialMp.deleteMany({
      where: { comercioId: { in: SEED_COMERCIO_IDS } },
    });
    await tx.auditoriaVencimientoOferta.deleteMany({
      where: { productoId: { in: SEED_PRODUCTO_IDS } },
    });
    await tx.producto.deleteMany({
      where: { idProducto: { in: SEED_PRODUCTO_IDS } },
    });
    await tx.comercio.deleteMany({
      where: { idComercio: { in: SEED_COMERCIO_IDS } },
    });
    await tx.direccion.deleteMany({
      where: { usuarioId: { in: SEED_USER_IDS } },
    });
    await tx.usuario.deleteMany({
      where: { id: { in: SEED_USER_IDS } },
    });
  });
}

async function crearUsuarios(
  prisma: PrismaClient,
  passwordHash: string,
): Promise<void> {
  for (const usuario of usuarios) {
    await prisma.usuario.create({
      data: {
        ...usuario,
        passwordHash,
      },
    });
  }
}

async function crearDirecciones(prisma: PrismaClient): Promise<void> {
  const direcciones = [
    {
      id: IDS.DIRECCION.altaPendiente1,
      usuarioId: IDS.USER.altaPendiente1,
      calle: 'San Martín',
      numero: '1001',
      descripcion: 'Dirección del alta pendiente uno.',
      latitud: '-54.808144',
      longitud: '-68.311948',
    },
    {
      id: IDS.DIRECCION.altaPendiente2,
      usuarioId: IDS.USER.altaPendiente2,
      calle: 'Kuanip',
      numero: '1002',
      descripcion: 'Dirección del alta pendiente dos.',
      latitud: '-54.818471',
      longitud: '-68.339811',
    },
    {
      id: IDS.DIRECCION.altaRechazada,
      usuarioId: IDS.USER.altaRechazada,
      calle: 'Gobernador Paz',
      numero: '1003',
      descripcion: 'Dirección del alta rechazada.',
      latitud: '-54.812443',
      longitud: '-68.330813',
    },
    {
      id: IDS.DIRECCION.altaAprobadaReciente,
      usuarioId: IDS.USER.altaAprobadaReciente,
      calle: 'Malvinas Argentinas',
      numero: '1004',
      descripcion: 'Dirección del alta aprobada reciente.',
      latitud: '-54.818744',
      longitud: '-68.323859',
    },
    {
      id: IDS.DIRECCION.altaAprobadaVieja,
      usuarioId: IDS.USER.altaAprobadaVieja,
      calle: 'Ruta 3',
      numero: '1005',
      descripcion: 'Dirección del alta aprobada vieja.',
      latitud: '-54.788253',
      longitud: '-68.225185',
    },
  ];

  for (const direccion of direcciones) {
    await prisma.direccion.create({
      data: {
        ...direccion,
        etiqueta: 'Casa',
        localidad: 'Ushuaia',
        esPredeterminada: true,
      },
    });
  }
}

async function crearComercios(
  prisma: PrismaClient,
  adminId: string,
): Promise<void> {
  for (const comercio of comercios) {
    await prisma.comercio.create({
      data: {
        ...comercio,
        resueltoPorId: comercio.resueltoEn ? adminId : null,
      },
    });
  }
}

async function crearProductos(
  prisma: PrismaClient,
  categorias: Map<string, string>,
): Promise<void> {
  for (const producto of productos) {
    const categoriaId = categorias.get(producto.categoriaSlug);
    if (!categoriaId) {
      throw new Error(
        `Falta la categoría ${producto.categoriaSlug}. Ejecutá npm run seed primero.`,
      );
    }

    await prisma.producto.create({
      data: {
        idProducto: producto.idProducto,
        comercioId: producto.comercioId,
        categoriaId,
        titulo: producto.titulo,
        descripcion: producto.descripcion,
        fechaVencimiento: producto.fechaVencimiento,
        stock: producto.stock,
        precioLista: producto.precioLista,
        precioBaseNeto: producto.precioBaseNeto,
        precioPublico: producto.precioPublico,
        comisionMenorcostTasaAplicada: COMISION_MENORCOST,
        tasaMpEstimadaAplicada: TASA_MP,
        imagen: '/uploads/producto-test.png',
        estado: producto.estado,
        pausadoPorBaja: producto.pausadoPorBaja,
      },
    });
  }
}

async function crearPedidos(prisma: PrismaClient): Promise<void> {
  for (const pedido of pedidos) {
    await prisma.pedido.create({
      data: {
        id_pedido: pedido.idPedido,
        nroPedido: pedido.nroPedido,
        usuarioId: pedido.usuarioId,
        comercioId: pedido.comercioId,
        estado: pedido.estado,
        codigoQR: pedido.codigoQR,
        codigoAlfanumerico: pedido.codigoAlfanumerico,
        fecha_pedido: pedido.fechaPedido,
        subtotal: pedido.subtotal,
        tarifa_servicio: pedido.tarifaServicio,
        comisionMenorcostTasa: COMISION_MENORCOST,
        tasaMpEstimada: TASA_MP,
        total: pedido.total,
        formaPago: 'MERCADO_PAGO',
        items: {
          create: [
            {
              productoId: pedido.productoId,
              nroLinea: 1,
              cantidad: pedido.cantidad,
              precio_unitario: pedido.precioUnitario,
              precioBaseNetoAplicado: pedido.precioBaseNeto,
              comisionMenorcostMonto: pedido.comision,
              subtotal: pedido.subtotal,
              nombreHistorico: pedido.tituloProducto,
              fechaVencimientoHistorica: pedido.fechaVencimientoProducto,
            },
          ],
        },
      },
    });
  }
}

async function crearPedidoBloqueado(
  prisma: PrismaClient,
  productoDemo: {
    idProducto: string;
    comercioId: string;
    titulo: string;
    fechaVencimiento: Date;
  },
): Promise<void> {
  await prisma.pedido.create({
    data: {
      id_pedido: IDS.PEDIDO.bajaBloqueado,
      nroPedido: 'BO-PED-0003',
      usuarioId: IDS.USER.bajaBloqueada,
      comercioId: productoDemo.comercioId,
      estado: 'PENDIENTE_DE_RETIRO',
      codigoQR: 'BO-QR-0003',
      codigoAlfanumerico: 'BO0003',
      fecha_pedido: fecha(-1),
      subtotal: '3500.00',
      tarifa_servicio: '350.00',
      comisionMenorcostTasa: COMISION_MENORCOST,
      tasaMpEstimada: TASA_MP,
      total: '3500.00',
      formaPago: 'MERCADO_PAGO',
      items: {
        create: [
          {
            productoId: productoDemo.idProducto,
            nroLinea: 1,
            cantidad: 1,
            precio_unitario: '3500.00',
            precioBaseNetoAplicado: '2800.00',
            comisionMenorcostMonto: '350.00',
            subtotal: '3500.00',
            nombreHistorico: productoDemo.titulo,
            fechaVencimientoHistorica: productoDemo.fechaVencimiento,
          },
        ],
      },
    },
  });
}

async function crearBajas(
  prisma: PrismaClient,
  adminId: string,
): Promise<void> {
  for (const baja of bajas) {
    const resuelta = baja.estado !== 'PENDIENTE';
    await prisma.solicitudBaja.create({
      data: {
        ...baja,
        resueltoPorId: resuelta ? adminId : baja.resueltoPorId,
      },
    });
  }
}

async function crearReportes(
  prisma: PrismaClient,
  adminId: string,
): Promise<void> {
  for (const reporte of reportes) {
    const cerrado =
      reporte.estado === 'RESUELTO' || reporte.estado === 'DESESTIMADO';
    await prisma.reporte.create({
      data: {
        id_pedido: reporte.idPedido,
        id_emisor: reporte.idEmisor,
        id_denunciado: reporte.idDenunciado,
        tipo_destino: reporte.tipoDestino,
        motivo: reporte.motivo,
        motivoCodigo: reporte.motivoCodigo,
        descripcion: reporte.descripcion,
        estado_reporte: reporte.estado,
        fecha_reporte: reporte.fechaReporte,
        id_admin: cerrado ? adminId : reporte.idAdmin,
        fecha_resolucion: reporte.fechaResolucion,
      },
    });
  }
}

async function seedBackoffice(prisma: PrismaClient, adminId: string): Promise<void> {
  const admin = { id: adminId };

  const categoriasRequeridas = [
    'aceites-y-conservas',
    'leches',
    'gaseosas',
    'yogures',
  ];
  const categoriasDb = await prisma.categoria.findMany({
    where: { slug: { in: categoriasRequeridas } },
    select: { idCategoria: true, slug: true },
  });
  const categorias = new Map(
    categoriasDb.map((categoria) => [categoria.slug, categoria.idCategoria]),
  );

  for (const slug of categoriasRequeridas) {
    if (!categorias.has(slug)) {
      throw new Error(
        `Falta la categoría ${slug}. Ejecutá npm run seed antes del seed de backoffice.`,
      );
    }
  }

  const productoDemo = await prisma.producto.findUnique({
    where: { idProducto: PRODUCTO_DEMO_ID },
    select: {
      idProducto: true,
      comercioId: true,
      titulo: true,
      fechaVencimiento: true,
    },
  });

  if (!productoDemo) {
    throw new Error(
      'Falta el producto demo del seed principal. Ejecutá npm run seed antes del seed de backoffice.',
    );
  }

  const passwordHash = await hash(PASSWORD_DEMO, 10);

  await limpiarSeed(prisma);
  await crearUsuarios(prisma, passwordHash);
  await crearDirecciones(prisma);
  await crearComercios(prisma, admin.id);
  await crearProductos(prisma, categorias);
  await crearPedidos(prisma);
  await crearPedidoBloqueado(prisma, productoDemo);
  await crearBajas(prisma, admin.id);
  await crearReportes(prisma, admin.id);

  const [
    altasPendientes,
    altasAprobadas30Dias,
    bajasSolicitadas,
    denunciasAbiertas,
  ] = await Promise.all([
    prisma.usuario.count({
      where: {
        rol: 'COMERCIANTE',
        estado: 'PENDIENTE_VERIFICACION',
        deletedAt: null,
      },
    }),
    prisma.usuario.count({
      where: {
        rol: 'COMERCIANTE',
        estado: 'HABILITADO',
        createdAt: { gte: fecha(-30) },
        deletedAt: null,
      },
    }),
    prisma.solicitudBaja.count({ where: { estado: 'PENDIENTE' } }),
    prisma.reporte.count({
      where: {
        estado_reporte: {
          in: ['PENDIENTE_REVISION', 'BAJO_INVESTIGACION'],
        },
      },
    }),
  ]);

  console.log('Seed de backoffice aplicado.');
  console.log(`Altas pendientes: ${altasPendientes}`);
  console.log(`Altas aprobadas (30 días): ${altasAprobadas30Dias}`);
  console.log(`Bajas solicitadas: ${bajasSolicitadas}`);
  console.log(`Denuncias abiertas: ${denunciasAbiertas}`);
  console.log(`Usuarios sembrados: ${usuarios.length}`);
  console.log(`Contraseña de todos los usuarios: ${PASSWORD_DEMO}`);
  console.log('Altas pendientes:');
  console.log('  bo.alta.pendiente1@test.com');
  console.log('  bo.alta.pendiente2@test.com');
  console.log('Bajas pendientes:');
  console.log('  bo.baja.cliente.pendiente@test.com');
  console.log('  bo.baja.comercio.pendiente@test.com');
  console.log('  bo.baja.bloqueada@test.com');
  console.log('Denuncias abiertas:');
  console.log('  R1, R2, R3, R4 y R7');
  console.log('Denunciados:');
  console.log('  bo.denuncia.denunciado.comercio@test.com');
  console.log('  bo.denuncia.denunciado.bajo@test.com');
  console.log('  bo.denuncia.denunciado.sancionable@test.com');
  console.log('  bo.denuncia.denunciado.cliente@test.com');
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL no está definida');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    console.log('==> Aplicando seed base (categorías y datos demo)...');
    const adminId = await seedBase(prisma);
    console.log('==> Aplicando seed de backoffice (altas, bajas y denuncias)...');
    await seedBackoffice(prisma, adminId);
    console.log('Seed unificada aplicada correctamente.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
