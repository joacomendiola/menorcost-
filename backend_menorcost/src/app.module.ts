import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BajaModule } from './modules/bajas/baja.module.js';
import { DireccionesModule } from './modules/direcciones/direcciones.module.js';
import { UsuariosModule } from './modules/usuarios/usuarios.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsuariosModule,
    DireccionesModule,
    BajaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
