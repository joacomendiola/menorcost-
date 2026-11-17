import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { BackofficeService } from './backoffice.service.js';
import { RechazarAltaDto } from './dto/rechazar-alta.dto.js';
import { FiltroAdminDto } from './dto/filtro-admin.dto.js';
import { SancionarReporteDto } from './dto/sancionar-reporte.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR')
export class BackofficeController {
  constructor(private readonly backofficeService: BackofficeService) {}

  @Get('kpis')
  async getKpis() {
    return this.backofficeService.getKpis();
  }

  // --- MÓDULO ALTAS ---
  @Get('altas')
  async getAltas(@Query() filtro: FiltroAdminDto) {
    return this.backofficeService.listarAltas(filtro.search, filtro.estado);
  }

  @Patch('altas/:id/aprobar')
  async aprobarAlta(
    @Param('id') idComercio: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.backofficeService.aprobarAlta(idComercio, admin.id);
  }

  @Patch('altas/:id/rechazar')
  async rechazarAlta(
    @Param('id') idComercio: string,
    @Body() dto: RechazarAltaDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.backofficeService.rechazarAlta(idComercio, dto.motivo, admin.id);
  }

  // --- MÓDULO DENUNCIAS ---
  @Get('denuncias')
  async getDenuncias(@Query() filtro: FiltroAdminDto) {
    return this.backofficeService.listarDenuncias(filtro.search, filtro.estado);
  }

  @Patch('denuncias/:id/investigacion')
  async toggleInvestigacion(@Param('id', ParseIntPipe) idReporte: number) {
    return this.backofficeService.alternarInvestigacion(idReporte);
  }

  @Patch('denuncias/:id/desestimar')
  async desestimar(
    @Param('id', ParseIntPipe) idReporte: number,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.backofficeService.desestimar(idReporte, admin.id);
  }

  @Patch('denuncias/:id/resolver')
  async resolver(
    @Param('id', ParseIntPipe) idReporte: number,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.backofficeService.resolver(idReporte, admin.id);
  }

  @Patch('denuncias/:id/sancionar')
  async sancionar(
    @Param('id', ParseIntPipe) idReporte: number,
    @Body() dto: SancionarReporteDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.backofficeService.sancionar(
      idReporte,
      admin.id,
      dto?.alcance ?? 'CUENTA',
    );
  }

  // --- MÓDULO USUARIOS ---
  @Patch('usuarios/:id/rehabilitar')
  async rehabilitarUsuario(@Param('id') idUsuario: string) {
    return this.backofficeService.rehabilitarUsuario(idUsuario);
  }
}