import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { BajaService } from './baja.service.js';
import { ListarBajasQueryDto } from './dto/listar-bajas-query.dto.js';
import { RechazarBajaDto } from './dto/rechazar-baja.dto.js';

@Controller('admin/bajas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR')
export class AdminBajaController {
  constructor(private readonly bajaService: BajaService) {}

  @Get()
  listar(@Query() query: ListarBajasQueryDto) {
    return this.bajaService.listarSolicitudes(query.estado);
  }

  @Patch(':id/aprobar')
  aprobar(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.bajaService.aprobar(admin.id, id);
  }

  @Patch(':id/rechazar')
  rechazar(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RechazarBajaDto,
  ) {
    return this.bajaService.rechazar(admin.id, id, dto);
  }
}
