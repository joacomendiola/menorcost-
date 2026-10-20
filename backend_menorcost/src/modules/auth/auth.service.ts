import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import type { Usuario } from '../../generated/prisma/client.js';
import { EstadoUsuario } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { JwtPayload } from './interfaces/jwt-payload.interface.js';
import { aUsuarioPublico, type UsuarioPublico } from './usuario-publico.js';

const CREDENCIALES_INVALIDAS = 'Correo electrónico o contraseña incorrectos';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{
    accessToken: string;
    usuario: UsuarioPublico;
  }> {
    const usuario = await this.prisma.usuario.findFirst({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
    });

    if (!usuario || !(await compare(dto.password, usuario.passwordHash))) {
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }

    this.asegurarCuentaOperativa(usuario.estado);

    const accessToken = await this.firmarToken(usuario);

    return { accessToken, usuario: aUsuarioPublico(usuario) };
  }

  async validarSesion(id: string, tokenVersion: number): Promise<Usuario | null> {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id, deletedAt: null },
    });

    if (!usuario || usuario.tokenVersion !== tokenVersion) {
      return null;
    }

    return usuario;
  }

  firmarToken(usuario: Usuario): Promise<string> {
    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      tokenVersion: usuario.tokenVersion,
      comercioId: null,
    };

    return this.jwtService.signAsync(payload);
  }

  private asegurarCuentaOperativa(estado: EstadoUsuario): void {
    if (estado === EstadoUsuario.HABILITADO) {
      return;
    }

    switch (estado) {
      case EstadoUsuario.PENDIENTE_VERIFICACION:
        throw new ForbiddenException({
          code: 'CUENTA_PENDIENTE_VERIFICACION',
          message:
            'Tu cuenta está pendiente de verificación. Revisá tu correo electrónico.',
        });
      case EstadoUsuario.SUSPENDIDO:
        throw new ForbiddenException({
          code: 'CUENTA_SUSPENDIDA',
          message: 'Su cuenta se encuentra suspendida por la administración.',
        });
      case EstadoUsuario.SOLICITUD_BAJA_PENDIENTE:
        throw new ForbiddenException({
          code: 'CUENTA_BAJA_PENDIENTE',
          message: 'Tu cuenta tiene una solicitud de baja en curso.',
        });
      case EstadoUsuario.BAJO_INVESTIGACION:
        throw new ForbiddenException({
          code: 'CUENTA_BAJO_INVESTIGACION',
          message: 'Tu cuenta se encuentra bajo investigación.',
        });
      case EstadoUsuario.DOCUMENTACION_RECHAZADA:
        throw new ForbiddenException({
          code: 'CUENTA_DOCUMENTACION_RECHAZADA',
          message:
            'La documentación de tu cuenta fue rechazada. Revisá tu correo electrónico.',
        });
    }
  }
}
