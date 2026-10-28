import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { SimuladorPreciosController } from './simulador-precios.controller.js';
import { SimuladorPreciosService } from './simulador-precios.service.js';

@Module({
  imports: [AuthModule],
  controllers: [SimuladorPreciosController],
  providers: [SimuladorPreciosService, JwtAuthGuard, RolesGuard],
  exports: [SimuladorPreciosService],
})
export class SimuladorPreciosModule {}
