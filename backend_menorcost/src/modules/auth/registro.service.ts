import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import type { Usuario } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  BCRYPT_ROUNDS,
  EXPIRACION_OTP_MINUTOS,
  MSG_EDAD_MINIMA,
  MSG_OTP_INVALIDO,
} from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { CodigosService } from './codigos.service.js';
import type { ReenviarCodigoDto } from './dto/reenviar-codigo.dto.js';
import type { RegistroDto } from './dto/registro.dto.js';
import type { VerificarCuentaDto } from './dto/verificar-cuenta.dto.js';
import { MailerService } from './mailer/mailer.service.js';
import { correoVerificacion } from './mailer/templates.js';
import { aUsuarioPublico, type UsuarioPublico } from './usuario-publico.js';

@Injectable()
export class RegistroService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly codigos: CodigosService,
    private readonly mailer: MailerService,
  ) {}

  async registrar(dto: RegistroDto): Promise<{ message: string; email: string }> {
    const fechaNacimiento = new Date(dto.fechaNacimiento);
    this.validarEdadMinima(fechaNacimiento);

    const email = dto.email.toLowerCase();

    const existente = await this.prisma.usuario.findFirst({
      where: { OR: [{ email }, { dni: dto.dni }] },
    });

    if (existente) {
      if (existente.dni === dto.dni) {
        throw new ConflictException(
          'El DNI ingresado ya se encuentra vinculado a una cuenta existente',
        );
      }
      throw new ConflictException(
        'El correo electrónico ya pertenece a una cuenta registrada',
      );
    }

    const usuario = await this.prisma.usuario.create({
      data: {
        dni: dto.dni,
        nombre: dto.nombre,
        apellido: dto.apellido,
        email,
        telefono: dto.telefono,
        fechaNacimiento,
        passwordHash: await hash(dto.password, BCRYPT_ROUNDS),
        rol: 'CLIENTE',
        estado: 'PENDIENTE_VERIFICACION',
        direcciones: dto.direccion
          ? {
              create: {
                etiqueta: dto.direccion.etiqueta,
                calle: dto.direccion.calle,
                numero: dto.direccion.numero,
                piso: dto.direccion.piso,
                localidad: dto.direccion.localidad,
                descripcion: dto.direccion.descripcion,
                latitud: dto.direccion.latitud,
                longitud: dto.direccion.longitud,
                esPredeterminada: true,
              },
            }
          : undefined,
      },
    });

    await this.enviarCodigoVerificacion(usuario);

    return {
      message:
        'Cuenta creada con éxito. Revisá tu correo electrónico para verificarla.',
      email: usuario.email,
    };
  }

  async reenviarCodigo(dto: ReenviarCodigoDto): Promise<{ message: string }> {
    const usuario = await this.prisma.usuario.findFirst({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
    });

    if (usuario && usuario.estado === 'PENDIENTE_VERIFICACION') {
      await this.enviarCodigoVerificacion(usuario);
    }

    return {
      message:
        'Si la cuenta existe y está pendiente de verificación, te enviamos un nuevo código.',
    };
  }

  async verificarCuenta(dto: VerificarCuentaDto): Promise<{
    accessToken: string;
    usuario: UsuarioPublico;
  }> {
    const usuario = await this.prisma.usuario.findFirst({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
    });

    if (!usuario || usuario.estado !== 'PENDIENTE_VERIFICACION') {
      throw new BadRequestException(MSG_OTP_INVALIDO);
    }

    const registro = await this.codigos.validarPorUsuario(
      usuario.id,
      'VERIFICACION_EMAIL',
      dto.codigo,
    );

    if (!registro) {
      throw new BadRequestException(MSG_OTP_INVALIDO);
    }

    await this.codigos.consumir(registro.id);

    const actualizado = await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { estado: 'HABILITADO' },
    });

    return {
      accessToken: await this.authService.firmarToken(actualizado),
      usuario: aUsuarioPublico(actualizado),
    };
  }

  private validarEdadMinima(fechaNacimiento: Date): void {
    const hoy = new Date();
    const limite = new Date(
      hoy.getFullYear() - 8,
      hoy.getMonth(),
      hoy.getDate(),
    );

    if (Number.isNaN(fechaNacimiento.getTime()) || fechaNacimiento > limite) {
      throw new BadRequestException(MSG_EDAD_MINIMA);
    }
  }

  private async enviarCodigoVerificacion(usuario: Usuario): Promise<void> {
    const codigo = this.codigos.generarCodigoNumerico();

    await this.codigos.crear(
      usuario.id,
      'VERIFICACION_EMAIL',
      codigo,
      EXPIRACION_OTP_MINUTOS,
    );

    const { subject, html, text } = correoVerificacion(
      codigo,
      EXPIRACION_OTP_MINUTOS,
    );

    await this.mailer.enviar({ to: usuario.email, subject, html, text });
  }
}
