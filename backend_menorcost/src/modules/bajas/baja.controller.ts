import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { BajaService } from './baja.service.js';
import { SolicitarBajaDto } from './dto/solicitar-baja.dto.js';

@Controller('baja-cuenta')
@UseGuards(JwtAuthGuard)
export class BajaController {
  constructor(private readonly bajaService: BajaService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  solicitar(
    @CurrentUser() usuario: AuthenticatedUser,
    @Body() dto: SolicitarBajaDto,
  ) {
    return this.bajaService.solicitar(usuario.id, dto);
  }
}
