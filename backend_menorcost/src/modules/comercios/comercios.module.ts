import { Module } from '@nestjs/common';
import { ImageStorageService } from '../ofertas/image-store.service.js';
import { CategoriasController } from './categorias.controller.js';
import { ComerciosPublicosController } from './comercios-publicos.controller.js';
import { ComerciosController } from './comercios.controller.js';
import { ComerciosService } from './comercios.service.js';
import { DetalleOfertaPublicaController } from './detalle-oferta-publica.controller.js';
import { DetalleOfertaPublicaService } from './detalle-oferta-publica.service.js';

@Module({
  controllers: [
    ComerciosController,
    ComerciosPublicosController,
    DetalleOfertaPublicaController,
    CategoriasController,
  ],
  providers: [
    ComerciosService,
    DetalleOfertaPublicaService,
    ImageStorageService,
  ],
  exports: [ComerciosService],
})
export class ComerciosModule {}
