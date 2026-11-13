import { Controller, Get, Query } from '@nestjs/common';
import { CatalogoService } from './catalogo.service.js';
import { BuscarCatalogoDto, BuscarComerciosDto } from './dto/buscar-catalogo.dto.js';

@Controller('catalogo')
export class CatalogoController {
  constructor(private readonly catalogo: CatalogoService) {}

  @Get() listar(@Query() filtros: BuscarCatalogoDto) { return this.catalogo.listar(filtros); }

  @Get('comercios') buscarComercios(@Query() filtros: BuscarComerciosDto) { return this.catalogo.buscarComercios(filtros); }
}
