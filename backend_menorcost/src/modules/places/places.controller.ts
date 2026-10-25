import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { BuscarPlacesDto } from './dto/buscar-places.dto.js';
import { PlacesService } from './places.service.js';

@Controller('places')
@UseGuards(JwtAuthGuard)
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get('autocompletar')
  autocompletar(@Query() dto: BuscarPlacesDto) {
    return this.placesService.autocompletar(dto.texto);
  }

  @Get('detalle/:placeId')
  detalle(@Param('placeId') placeId: string) {
    return this.placesService.detalle(placeId);
  }
}
