import { Module } from '@nestjs/common';
import { DireccionesController } from './direcciones.controller.js';
import { DireccionesService } from './direcciones.service.js';

@Module({
  controllers: [DireccionesController],
  providers: [DireccionesService],
  exports: [DireccionesService],
})
export class DireccionesModule {}
