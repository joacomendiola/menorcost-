import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificacionesController } from './notificaciones.controller.js';
import { NotificacionesService } from './notificaciones.service.js';

@Module({
  imports: [AuthModule],
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
})
export class NotificacionesModule {}