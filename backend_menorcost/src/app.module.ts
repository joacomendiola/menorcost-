import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BajaModule } from './modules/bajas/baja.module.js';
import { DireccionesModule } from './modules/direcciones/direcciones.module.js';
import { UsuariosModule } from './modules/usuarios/usuarios.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ConfigModule } from '@nestjs/config';
import { OffersModule } from './modules/ofertas/ofertas.module.js';
import { ReputacionModule } from './modules/reputacion/reputacion.module.js';
import { BackofficeModule } from './modules/backoffice/backoffice.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsuariosModule,
    DireccionesModule,
    BajaModule,
    ReputacionModule,
    BackofficeModule,
    ConfigModule.forRoot({ isGlobal: true }),
    OffersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
