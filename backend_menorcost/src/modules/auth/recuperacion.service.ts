import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash } from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  BCRYPT_ROUNDS,
  EXPIRACION_RESET_MINUTOS,
  MSG_RESET_EXPIRADO,
  MSG_RESET_GENERICO,
} from './auth.constants.js';
import { CodigosService } from './codigos.service.js';
import type { OlvidarPasswordDto } from './dto/olvidar-password.dto.js';
import type { RestablecerPasswordDto } from './dto/restablecer-password.dto.js';
import { MailerService } from './mailer/mailer.service.js';
import { correoRecuperacion } from './mailer/templates.js';

@Injectable()
export class RecuperacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly codigos: CodigosService,
    private readonly mailer: MailerService,
  ) {}

  async solicitar(dto: OlvidarPasswordDto): Promise<{ message: string }> {
    const usuario = await this.prisma.usuario.findFirst({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
    });

    if (usuario && usuario.estado !== 'SUSPENDIDO') {
      const token = this.codigos.generarToken();

      await this.codigos.crear(
        usuario.id,
        'RECUPERACION_PASSWORD',
        token,
        EXPIRACION_RESET_MINUTOS,
      );

      const frontendUrl =
        this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
      const enlace = `${frontendUrl}/restablecer-password?token=${token}`;

      const { subject, html, text } = correoRecuperacion(
        enlace,
        EXPIRACION_RESET_MINUTOS,
      );

      await this.mailer.enviar({ to: usuario.email, subject, html, text });
    }

    return { message: MSG_RESET_GENERICO };
  }

  async restablecer(dto: RestablecerPasswordDto): Promise<{ message: string }> {
    const registro = await this.codigos.buscarPorToken(
      'RECUPERACION_PASSWORD',
      dto.token,
    );

    if (!registro) {
      throw new BadRequestException(MSG_RESET_EXPIRADO);
    }

    const passwordHash = await hash(dto.password, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: registro.usuarioId },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      }),
      this.prisma.codigoSeguridad.update({
        where: { id: registro.id },
        data: { usadoEn: new Date() },
      }),
    ]);

    return { message: 'Contraseña actualizada correctamente.' };
  }
}
