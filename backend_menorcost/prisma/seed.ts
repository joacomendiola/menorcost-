import 'dotenv/config';
import { hash } from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

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

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL no está definida');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
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
        calle: 'Avenida San MartÃ­n',
        numero: '1200',
        localidad: 'Ushuaia',
        descripcion: 'Dirección de prueba para explorar por cercanía',
        latitud: '-54.807300',
        longitud: '-68.308400',
        esPredeterminada: true,
        deletedAt: null,
      },
      create: {
        id: '00000000-0000-4000-8000-000000000121',
        usuarioId: clienteDemo.id,
        etiqueta: 'Casa',
        calle: 'Avenida San MartÃ­n',
        numero: '1200',
        localidad: 'Ushuaia',
        descripcion: 'Dirección de prueba para explorar por cercanía',
        latitud: '-54.807300',
        longitud: '-68.308400',
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
        latitud: '-54.807600',
        longitud: '-68.304000',
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
        cuit: '30-12345678-2',
        googlePlaceId: 'menorcost-demo-barrio',
        calle: 'Kuanip',
        numero: '2400',
        localidad: 'Ushuaia',
        provincia: 'Tierra del Fuego',
        codigoPostal: '9410',
        telefono: '+54 2901 555551',
        latitud: '-54.813000',
        longitud: '-68.337000',
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
        estado: 'HABILITADO',
        mercadoPagoVinculado: true,
        abierto: true,
        calle: 'San Martin',
        numero: '123',
        localidad: 'Ushuaia',
        provincia: 'Tierra del Fuego',
        codigoPostal: '9410',
        latitud: '-54.801912',
        longitud: '-68.302951',
      },
      create: {
        idComercio: '00000000-0000-4000-8000-000000000202',
        userId: comercianteVencido.id,
        mercadoPagoVinculado: true,
        nombreFantasia: 'Comercio CU-2.07',
        razonSocial: 'Comercio CU-2.07 S.R.L.',
        cuit: '30-12345678-9',
        telefono: '+54 2901 555557',
        descripcion: 'Comercio usado para probar el vencimiento automático.',
        calle: 'San Martín',
        numero: '123',
        localidad: 'Ushuaia',
        provincia: 'Tierra del Fuego',
        codigoPostal: '9410',
        latitud: '-54.801912',
        longitud: '-68.302951',
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
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
