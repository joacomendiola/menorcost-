import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module.js';
import { BajaModule } from './modules/bajas/baja.module.js';
import { ComerciosModule } from './modules/comercios/comercios.module.js';
import { DireccionesModule } from './modules/direcciones/direcciones.module.js';
import { PlacesModule } from './modules/places/places.module.js';
import { UsuariosModule } from './modules/usuarios/usuarios.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ConfigModule } from '@nestjs/config';
import { OffersModule } from './modules/ofertas/ofertas.module.js';
import { ReputacionModule } from './modules/reputacion/reputacion.module.js';
import { BackofficeModule } from './modules/backoffice/backoffice.module.js';
import { ReportesModule } from './modules/reportes/reportes.module.js';
import { SimuladorPreciosModule } from './modules/simulador-precios/simulador-precios.module.js';
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
    OffersModule,
    SimuladorPreciosModule,
  ],
})
export class AppModule { }
