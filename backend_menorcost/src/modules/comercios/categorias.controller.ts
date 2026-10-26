import { Controller, Get } from '@nestjs/common';
import { ComerciosService } from './comercios.service.js';

@Controller('categorias')
export class CategoriasController {
  constructor(private readonly comerciosService: ComerciosService) {}

  @Get()
  listar() {
    return this.comerciosService.listarCategorias();
  }
}
