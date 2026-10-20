import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service.js';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const usuario = await this.authService.validarSesion(
      payload.sub,
      payload.tokenVersion,
    );

    if (!usuario) {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }

    return {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      estado: usuario.estado,
      comercioId: payload.comercioId ?? null,
    };
  }
}
