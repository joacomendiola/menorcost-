import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ReputacionService } from './reputacion.service.js';
import { CrearCalificacionDto } from './dto/crear-calificacion.dto.js';
import { ListarResenasQueryDto } from './dto/listar-resenas-query.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';

@Controller('reputation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReputacionController {
  constructor(private readonly reputacionService: ReputacionService) {}

  @Get('my-store')
  @Roles('COMERCIANTE')
  async getMyStoreReputation(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListarResenasQueryDto,
  ) {
    return this.reputacionService.obtenerReputacionComercioPorUsuario(user.id, query);
  }

  @Post('rate')
  @Roles('CLIENTE')
  async calificarPedido(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CrearCalificacionDto,
  ) {
    return this.reputacionService.crearCalificacion(user.id, dto);
  }
}