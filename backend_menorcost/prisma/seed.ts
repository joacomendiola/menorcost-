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
      { nombre: 'Facturas y medialunas', slug: 'facturas-y-medialunas', orden: 2 },
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
        passwordHash: await hash('Password123', 10),
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
        passwordHash: await hash('Password123', 10),
        rol: 'CLIENTE',
        estado: 'HABILITADO',
      },
    });

    console.log(`Cliente demo sincronizado: ${clienteDemo.email}`);

    const adminDemo =
      process.env.NODE_ENV === 'production'
        ? null
        : await prisma.usuario.upsert({
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

    if (adminDemo) {
      console.log(`Administrador demo sincronizado: ${adminDemo.email}`);
    }

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
