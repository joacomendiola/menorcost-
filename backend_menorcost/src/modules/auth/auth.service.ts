import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import type { Usuario } from '../../generated/prisma/client.js';
import { EstadoUsuario } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { BCRYPT_ROUNDS } from './auth.constants.js';
import { esEstadoUsuarioOperativo } from './estados-usuario.js';
import type { CambiarPasswordDto } from './dto/cambiar-password.dto.js';
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

  async cambiarPassword(
    usuarioId: string,
    dto: CambiarPasswordDto,
  ): Promise<{ message: string }> {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: usuarioId, deletedAt: null },
    });

    if (!usuario) {
      throw new BadRequestException(
        'No pudimos actualizar la contraseña. Iniciá sesión nuevamente.',
      );
    }

    if (!(await compare(dto.passwordActual, usuario.passwordHash))) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }

    const passwordHash = await hash(dto.passwordNueva, BCRYPT_ROUNDS);

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });

    return { message: 'Contraseña actualizada correctamente.' };
  }

  async validarSesion(id: string, tokenVersion: number): Promise<Usuario | null> {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id, deletedAt: null },
    });

    if (
      !usuario ||
      usuario.tokenVersion !== tokenVersion ||
      !esEstadoUsuarioOperativo(usuario.estado)
    ) {
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
    if (
      estado === EstadoUsuario.HABILITADO ||
      estado === EstadoUsuario.BAJO_INVESTIGACION
    ) {
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
      case EstadoUsuario.DOCUMENTACION_RECHAZADA:
        throw new ForbiddenException({
          code: 'CUENTA_DOCUMENTACION_RECHAZADA',
          message:
            'La documentación de tu cuenta fue rechazada. Revisá tu correo electrónico.',
        });
    }
  }
}
