import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { ComerciosService } from './comercios.service.js';
import { ActualizarAperturaDto } from './dto/actualizar-apertura.dto.js';
import { ActualizarComercioDto } from './dto/actualizar-comercio.dto.js';
import { GuardarConfiguracionHorariaDto } from './dto/configuracion-horaria.dto.js';
import { CrearComercioDto } from './dto/crear-comercio.dto.js';
import { ReemplazarFranjasDto } from './dto/franja-retiro.dto.js';
import { ReemplazarHorariosDto } from './dto/horario-atencion.dto.js';

@Controller('comercios')
@UseGuards(JwtAuthGuard)
export class ComerciosController {
  constructor(private readonly comerciosService: ComerciosService) {}

  @Get('mio')
  obtenerMio(@CurrentUser() usuario: AuthenticatedUser) {
    return this.comerciosService.obtenerMio(usuario.id);
  }

  @Post()
  crear(
    @CurrentUser() usuario: AuthenticatedUser,
    @Body() dto: CrearComercioDto,
  ) {
    return this.comerciosService.crear(usuario.id, dto);
  }

  @Patch('mio')
  actualizarMio(
    @CurrentUser() usuario: AuthenticatedUser,
    @Body() dto: ActualizarComercioDto,
  ) {
    return this.comerciosService.actualizarMio(usuario.id, dto);
  }

  @Patch('mio/abierto')
  actualizarApertura(
    @CurrentUser() usuario: AuthenticatedUser,
    @Body() dto: ActualizarAperturaDto,
  ) {
    return this.comerciosService.actualizarApertura(usuario.id, dto);
  }

  @Get('mio/horarios')
  obtenerHorarios(@CurrentUser() usuario: AuthenticatedUser) {
    return this.comerciosService.obtenerHorarios(usuario.id);
  }

  @Put('mio/horarios')
  reemplazarHorarios(
    @CurrentUser() usuario: AuthenticatedUser,
    @Body() dto: ReemplazarHorariosDto,
  ) {
    return this.comerciosService.reemplazarHorarios(usuario.id, dto);
  }

  @Get('mio/franjas')
  obtenerFranjas(@CurrentUser() usuario: AuthenticatedUser) {
    return this.comerciosService.obtenerFranjas(usuario.id);
  }

  @Put('mio/franjas')
  reemplazarFranjas(
    @CurrentUser() usuario: AuthenticatedUser,
    @Body() dto: ReemplazarFranjasDto,
  ) {
    return this.comerciosService.reemplazarFranjas(usuario.id, dto);
  }

  @Put('mio/configuracion-horaria')
  reemplazarConfiguracionHoraria(
    @CurrentUser() usuario: AuthenticatedUser,
    @Body() dto: GuardarConfiguracionHorariaDto,
  ) {
    return this.comerciosService.reemplazarConfiguracionHoraria(
      usuario.id,
      dto,
    );
  }
}
