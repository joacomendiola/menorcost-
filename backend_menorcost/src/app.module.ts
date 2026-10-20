import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { OffersModule } from './offers/offers.module.js';

@Module({
  // TODO integración: importar aquí los módulos reales que deban compartirse
  // (por ejemplo, autenticación, Prisma, comercios o categorías), según cómo
  // los organicemos más adelante.
  imports: [OffersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
