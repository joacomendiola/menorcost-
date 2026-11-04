import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module.js';
import { OffersExpirationService } from '../src/modules/ofertas/ofertas-expiration.service.js';

console.log('Iniciando contexto de NestJS...');

const app = await NestFactory.createApplicationContext(AppModule);

try {
  console.log('Contexto iniciado. Ejecutando depuración...');

  const expirationService = app.get(OffersExpirationService);
  const expiredCount = await expirationService.expireOffers();

  console.log(`Ofertas depuradas: ${expiredCount}`);
} catch (error: unknown) {
  console.error('Error ejecutando la depuración:', error);
  process.exitCode = 1;
} finally {
  await app.close();
  console.log('Proceso finalizado.');
}