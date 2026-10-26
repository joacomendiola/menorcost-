import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const categorias = [
  { nombre: 'Almacén', slug: 'almacen', orden: 1 },
  { nombre: 'Lácteos', slug: 'lacteos', orden: 2 },
  { nombre: 'Fiambrería', slug: 'fiambreria', orden: 3 },
  { nombre: 'Bebidas', slug: 'bebidas', orden: 4 },
  { nombre: 'Golosinas', slug: 'golosinas', orden: 5 },
  { nombre: 'Panadería', slug: 'panaderia', orden: 6 },
  { nombre: 'Limpieza', slug: 'limpieza', orden: 7 },
];

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL no está definida');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const resultado = await Promise.all(
      categorias.map((categoria) =>
        prisma.categoria.upsert({
          where: { slug: categoria.slug },
          update: {
            nombre: categoria.nombre,
            orden: categoria.orden,
            activa: true,
          },
          create: categoria,
        }),
      ),
    );

    console.log(`Categorías sincronizadas: ${resultado.length}`);
    console.table(
      resultado.map((categoria) => ({
        id: categoria.idCategoria,
        nombre: categoria.nombre,
        slug: categoria.slug,
        orden: categoria.orden,
      })),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
