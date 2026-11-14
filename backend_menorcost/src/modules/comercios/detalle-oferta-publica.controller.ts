import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { DetalleOfertaPublicaService } from './detalle-oferta-publica.service.js';

@Controller('comercios/publicos')
export class DetalleOfertaPublicaController {
  constructor(
    private readonly detalleOfertaPublicaService: DetalleOfertaPublicaService,
  ) {}

  @Get(':comercioId/productos/:productoId')
  obtenerProducto(
    @Param('comercioId', ParseUUIDPipe) comercioId: string,
    @Param('productoId', ParseUUIDPipe) productoId: string,
  ) {
    return this.detalleOfertaPublicaService.obtener(
      comercioId,
      productoId,
    );
  }
}