import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { NotificacionesService } from './notificaciones.service.js';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificacionesController {
  constructor(
    private readonly notificacionesService: NotificacionesService,
  ) {}

  @Get()
  listar(@CurrentUser() usuario: AuthenticatedUser) {
    return this.notificacionesService.listarPorUsuario(usuario.id);
  }

  @Patch(':id/read')
  marcarComoLeida(
    @CurrentUser() usuario: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) notificacionId: string,
  ) {
    return this.notificacionesService.marcarComoLeida(
      usuario.id,
      notificacionId,
    );
  }
}