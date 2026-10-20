import { Module } from '@nestjs/common';
import { AdminBajaController } from './admin-baja.controller.js';
import { BajaController } from './baja.controller.js';
import { BajaService } from './baja.service.js';
import { BAJA_BLOQUEOS_PORT } from './bloqueos/baja-bloqueos.port.js';
import { SinBloqueosProvider } from './bloqueos/sin-bloqueos.provider.js';

@Module({
  controllers: [BajaController, AdminBajaController],
  providers: [
    BajaService,
    { provide: BAJA_BLOQUEOS_PORT, useClass: SinBloqueosProvider },
  ],
})
export class BajaModule {}
