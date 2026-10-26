import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ComerciosService } from './comercios.service.js';

@Controller('comercios/publicos')
export class ComerciosPublicosController {
  constructor(private readonly comerciosService: ComerciosService) {}

  @Get(':id')
  obtener(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.comerciosService.obtenerPublico(id);
  }
}
