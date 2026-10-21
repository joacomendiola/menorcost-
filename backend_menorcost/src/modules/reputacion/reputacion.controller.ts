import { Controller, Get, UseGuards } from '@nestjs/common';
import { ReputacionService } from './reputacion.service.js';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

// import { CurrentShop } from '../auth/decorators/current-shop.decorator';

@Controller('reputation')
// @UseGuards(JwtAuthGuard) 
export class ReputacionController {
  constructor(private readonly reputacionService: ReputacionService) {}

  @Get('my-store')
  async getMyStoreReputation(
    // @CurrentShop() idComercio: string
  ) {
    // ID temporal hardcodeado para probar el endpoint hasta tener el token JWT real
    const idComercioMock = 'UUID-DEL-COMERCIO-ACTIVO'; 
    return this.reputacionService.obtenerReputacionComercio(idComercioMock);
  }
}