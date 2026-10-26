import { Module } from '@nestjs/common';
import { DireccionesModule } from '../direcciones/direcciones.module.js';
import { UsuariosController } from './usuarios.controller.js';
import { UsuariosService } from './usuarios.service.js';

@Module({
  imports: [DireccionesModule],
  controllers: [UsuariosController],
  providers: [UsuariosService],
})
export class UsuariosModule {}
