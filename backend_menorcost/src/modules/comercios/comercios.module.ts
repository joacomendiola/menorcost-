import { Module } from '@nestjs/common';
import { CategoriasController } from './categorias.controller.js';
import { ComerciosController } from './comercios.controller.js';
import { ComerciosService } from './comercios.service.js';

@Module({
  controllers: [ComerciosController, CategoriasController],
  providers: [ComerciosService],
  exports: [ComerciosService],
})
export class ComerciosModule {}
