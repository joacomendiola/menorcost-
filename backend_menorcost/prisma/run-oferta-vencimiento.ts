import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { OffersExpirationService } from '../src/modules/ofertas/ofertas-vencimiento.service.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL no está definida');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

console.log('Iniciando depuración de ofertas vencidas...');

try {
  const expirationService = new OffersExpirationService(prisma as never);
  const expiredCount = await expirationService.expireOffers();

  console.log(`Ofertas depuradas: ${expiredCount}`);
} catch (error: unknown) {
  console.error('Error ejecutando la depuración:', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  console.log('Proceso finalizado.');
}