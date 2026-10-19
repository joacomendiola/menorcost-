import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const origenesPermitidos = (
    process.env.CORS_ORIGIN ??
    'http://localhost:5173,http://localhost:5199'
  )
    .split(',')
    .map((origen) => origen.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origenesPermitidos,
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
