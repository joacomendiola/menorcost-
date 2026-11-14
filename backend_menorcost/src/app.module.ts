import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module.js';
import { BackofficeModule } from './modules/backoffice/backoffice.module.js';
import { BajaModule } from './modules/bajas/baja.module.js';
import { CanastasModule } from './modules/canastas/canastas.module.js';
import { ComerciosModule } from './modules/comercios/comercios.module.js';
import { DireccionesModule } from './modules/direcciones/direcciones.module.js';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module.js';
import { OffersModule } from './modules/ofertas/ofertas.module.js';
import { PlacesModule } from './modules/places/places.module.js';
import { ReportesModule } from './modules/reportes/reportes.module.js';
import { ReputacionModule } from './modules/reputacion/reputacion.module.js';
import { SimuladorPreciosModule } from './modules/simulador-precios/simulador-precios.module.js';
import { UsuariosModule } from './modules/usuarios/usuarios.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsuariosModule,
    DireccionesModule,
    ComerciosModule,
    PlacesModule,
    BajaModule,
    ReputacionModule,
    BackofficeModule,
    ReportesModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    OffersModule,
    NotificacionesModule,
    SimuladorPreciosModule,
    CanastasModule,
  ],
})
export class AppModule {}
