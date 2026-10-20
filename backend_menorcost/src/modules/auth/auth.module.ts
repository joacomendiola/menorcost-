import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { SignOptions } from 'jsonwebtoken';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CodigosService } from './codigos.service.js';
import { MailerService } from './mailer/mailer.service.js';
import { RecuperacionController } from './recuperacion.controller.js';
import { RecuperacionService } from './recuperacion.service.js';
import { RegistroController } from './registro.controller.js';
import { RegistroService } from './registro.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ??
            '1h') as SignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [
    AuthController,
    RegistroController,
    RecuperacionController,
  ],
  providers: [
    AuthService,
    RegistroService,
    RecuperacionService,
    CodigosService,
    JwtStrategy,
    MailerService,
  ],
  exports: [AuthService, MailerService],
})
export class AuthModule {}
