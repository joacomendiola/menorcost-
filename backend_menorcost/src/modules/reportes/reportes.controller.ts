import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ReportesService } from './reportes.service.js';
import { CrearReporteDto } from './dto/crear-reporte.dto.js';
import { ListarMisReportesQueryDto } from './dto/listar-mis-reportes-query.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Post()
  @Roles('CLIENTE', 'COMERCIANTE')
  async crearReporte(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CrearReporteDto,
  ) {
    return this.reportesService.crearReporte(user.id, user.rol, dto);
  }

  @Get('my-reports')
  @Roles('CLIENTE', 'COMERCIANTE')
  async listarMisReportes(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListarMisReportesQueryDto,
  ) {
    return this.reportesService.listarMisReportes(user.id, query);
  }

  @Get(':id')
  @Roles('CLIENTE', 'COMERCIANTE', 'ADMINISTRADOR')
  async obtenerDetalleReporte(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) idReporte: number,
  ) {
    return this.reportesService.obtenerDetalleReporte(user.id, idReporte, user.rol);
  }
}