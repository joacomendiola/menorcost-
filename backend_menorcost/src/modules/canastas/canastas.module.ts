import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CanastasController } from './canastas.controller.js';
import { CanastasService } from './canastas.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CanastasController],
  providers: [CanastasService],
})
export class CanastasModule {}