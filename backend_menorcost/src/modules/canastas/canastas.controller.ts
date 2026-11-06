import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { AgregarCanastaItemDto } from './dto/agregar-canasta-item.dto.js';
import { CanastasService } from './canastas.service.js';

@Controller('canastas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CLIENTE')
export class CanastasController {
  constructor(private readonly canastasService: CanastasService) {}

  @Get()
  obtenerTodas(@CurrentUser() usuario: AuthenticatedUser) {
    return this.canastasService.obtenerTodas(usuario.id);
  }

  @Get(':comercioId')
  obtenerPorComercio(
    @CurrentUser() usuario: AuthenticatedUser,
    @Param('comercioId', ParseUUIDPipe) comercioId: string,
  ) {
    return this.canastasService.obtenerPorComercio(
      usuario.id,
      comercioId,
    );
  }

  @Post(':comercioId/items')
  agregarProducto(
    @CurrentUser() usuario: AuthenticatedUser,
    @Param('comercioId', ParseUUIDPipe) comercioId: string,
    @Body() dto: AgregarCanastaItemDto,
  ) {
    return this.canastasService.agregarProducto(
      usuario.id,
      comercioId,
      dto,
    );
  }
}