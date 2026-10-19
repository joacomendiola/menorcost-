import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { DireccionesService } from './direcciones.service.js';
import { ActualizarDireccionDto } from './dto/actualizar-direccion.dto.js';
import { CrearDireccionDto } from './dto/crear-direccion.dto.js';

@Controller('direcciones')
@UseGuards(JwtAuthGuard)
export class DireccionesController {
  constructor(private readonly direccionesService: DireccionesService) {}

  @Get()
  listar(@CurrentUser() usuario: AuthenticatedUser) {
    return this.direccionesService.listar(usuario.id);
  }

  @Post()
  crear(
    @CurrentUser() usuario: AuthenticatedUser,
    @Body() dto: CrearDireccionDto,
  ) {
    return this.direccionesService.crear(usuario.id, dto);
  }

  @Patch(':id')
  actualizar(
    @CurrentUser() usuario: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ActualizarDireccionDto,
  ) {
    return this.direccionesService.actualizar(usuario.id, id, dto);
  }

  @Delete(':id')
  eliminar(
    @CurrentUser() usuario: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.direccionesService.eliminar(usuario.id, id);
  }

  @Patch(':id/predeterminada')
  marcarPredeterminada(
    @CurrentUser() usuario: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.direccionesService.marcarPredeterminada(usuario.id, id);
  }
}
