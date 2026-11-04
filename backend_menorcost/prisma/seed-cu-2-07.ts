import 'dotenv/config';
import { hash } from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL no está definida');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const usuarioId = '00000000-0000-4000-8000-000000000201';
const comercioId = '00000000-0000-4000-8000-000000000202';
const productoId = '00000000-0000-4000-8000-000000000203';

async function main(): Promise<void> {
  const categoria = await prisma.categoria.findFirst({
    where: {
      activa: true,
    },
    orderBy: {
      orden: 'asc',
    },
  });

  if (!categoria) {
    throw new Error(
      'No existe ninguna categoría activa. Ejecutá primero npm run seed.',
    );
  }

  const passwordHash = await hash('Password123', 10);

  await prisma.usuario.upsert({
    where: {
      id: usuarioId,
    },
    update: {
      dni: '20123458',
      nombre: 'Comerciante',
      apellido: 'Demo',
      email: 'comerciante-cu207@test.com',
      telefono: '+54 2901 555557',
      fechaNacimiento: new Date('1990-04-15T00:00:00.000Z'),
      passwordHash,
      rol: 'COMERCIANTE',
      estado: 'HABILITADO',
      deletedAt: null,
    },
    create: {
      id: usuarioId,
      dni: '20123458',
      nombre: 'Comerciante',
      apellido: 'Demo',
      email: 'comerciante-cu207@test.com',
      telefono: '+54 2901 555557',
      fechaNacimiento: new Date('1990-04-15T00:00:00.000Z'),
      passwordHash,
      rol: 'COMERCIANTE',
      estado: 'HABILITADO',
    },
  });

  await prisma.comercio.upsert({
    where: {
      userId: usuarioId,
    },
    update: {
      estado: 'HABILITADO',
      mercadoPagoVinculado: true,
    },
    create: {
      idComercio: comercioId,
      userId: usuarioId,
      mercadoPagoVinculado: true,
      nombreFantasia: 'Comercio CU-2.07',
      razonSocial: 'Comercio CU-2.07 S.R.L.',
      cuit: '30-12345678-9',
      telefono: '+54 2901 555557',
      descripcion: 'Comercio utilizado para probar CU-2.07',
      calle: 'San Martín',
      numero: '123',
      localidad: 'Ushuaia',
      provincia: 'Tierra del Fuego',
      codigoPostal: '9410',
      latitud: '-54.801912',
      longitud: '-68.302951',
      googlePlaceId: 'cu-207-test-place',
      logoUrl: '/uploads/logo-test.png',
      estado: 'HABILITADO',
    },
  });

  await prisma.notificacion.deleteMany({
    where: {
      auditoriaVencimiento: {
        productoId,
      },
    },
  });

  await prisma.auditoriaVencimientoOferta.deleteMany({
    where: {
      productoId,
    },
  });

  await prisma.producto.upsert({
    where: {
      idProducto: productoId,
    },
    update: {
      comercioId,
      categoriaId: categoria.idCategoria,
      tipo: 'INDIVIDUAL',
      titulo: 'Oferta vencida CU-2.07',
      descripcion: 'Oferta creada para probar la depuración automática.',
      fechaVencimiento: new Date('2026-11-02T00:00:00.000Z'),
      stock: 5,
      precioLista: '100.00',
      precioMenorcost: '75.00',
      imagen: '/uploads/producto-test.png',
      estado: 'ACTIVO',
    },
    create: {
      idProducto: productoId,
      comercioId,
      categoriaId: categoria.idCategoria,
      tipo: 'INDIVIDUAL',
      titulo: 'Oferta vencida CU-2.07',
      descripcion: 'Oferta creada para probar la depuración automática.',
      fechaVencimiento: new Date('2026-11-02T00:00:00.000Z'),
      stock: 5,
      precioLista: '100.00',
      precioMenorcost: '75.00',
      imagen: '/uploads/producto-test.png',
      estado: 'ACTIVO',
    },
  });

  console.log('Datos de prueba CU-2.07 creados.');
  console.log('Usuario: comerciante-cu207@test.com');
  console.log('Contraseña: Password123');
  console.log(`Producto vencido: ${productoId}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });