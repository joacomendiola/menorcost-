import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { SimularPrecioDto } from './dto/simular-precio.dto.js';
import { SimuladorPreciosService } from './simulador-precios.service.js';
import type { SimulacionPrecioResultado } from './simulador-precios.types.js';

@Controller('simulador-precios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COMERCIANTE', 'ADMINISTRADOR')
export class SimuladorPreciosController {
  constructor(
    private readonly simuladorPreciosService: SimuladorPreciosService,
  ) {}

  @Post('calcular')
  calcular(@Body() dto: SimularPrecioDto): Promise<SimulacionPrecioResultado> {
    return this.simuladorPreciosService.calcular(dto);
  }
}
