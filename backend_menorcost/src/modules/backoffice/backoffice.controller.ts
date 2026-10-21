import { Controller, Get, Patch, Param, Body, Query, ParseIntPipe, UseGuards, Req } from '@nestjs/common';
import { BackofficeService } from './backoffice.service.js';
import { FiltroAdminDto } from './dto/filtro-admin.dto.js';
import { RechazarAltaDto } from './dto/rechazar-alta.dto.js';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard) // 1. Exige estar logueado y pasar por el control de roles
@Roles('ADMINISTRADOR')              // 2. Exige estrictamente que el rol en el token sea Admin
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
  async aprobarAlta(@Param('id') idComercio: string) {
    return this.backofficeService.aprobarAlta(idComercio);
  }

  @Patch('altas/:id/rechazar')
  async rechazarAlta(@Param('id') idComercio: string, @Body() dto: RechazarAltaDto) {
    return this.backofficeService.rechazarAlta(idComercio, dto.motivo);
  }

  // --- MÓDULO BAJAS ---
  @Get('bajas')
  async getBajas(@Query() filtro: FiltroAdminDto) {
    return this.backofficeService.listarBajas(filtro.search);
  }

  @Patch('bajas/:id/aprobar')
  async aprobarBaja(@Param('id') idUsuario: string) {
    return this.backofficeService.aprobarBaja(idUsuario);
  }

  @Patch('bajas/:id/rechazar')
  async rechazarBaja(@Param('id') idUsuario: string) {
    return this.backofficeService.rechazarBaja(idUsuario);
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

  @Patch('denuncias/:id/resolver')
  async marcarResuelto(
    @Param('id', ParseIntPipe) idReporte: number,
    @Req() req: any // Extraemos la Request para obtener el usuario del token
  ) {
    // El JwtAuthGuard inyecta los datos del token decodificado en req.user
    const idAdmin = req.user.id; 
    return this.backofficeService.marcarResuelto(idReporte, idAdmin);
  }

  @Patch('denuncias/:id/sancionar')
  async sancionar(
    @Param('id', ParseIntPipe) idReporte: number,
    @Req() req: any 
  ) {
    const idAdmin = req.user.id; 
    return this.backofficeService.sancionar(idReporte, idAdmin);
  }
}