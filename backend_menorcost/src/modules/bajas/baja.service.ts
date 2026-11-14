import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { compare } from 'bcryptjs';
import type { Prisma } from '../../generated/prisma/client.js';
import type { EstadoUsuario } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  BAJA_BLOQUEOS_PORT,
  type BajaBloqueosPort,
  type BloqueoBaja,
} from './bloqueos/baja-bloqueos.port.js';
import type { RechazarBajaDto } from './dto/rechazar-baja.dto.js';
import type { SolicitarBajaDto } from './dto/solicitar-baja.dto.js';

const MSG_BLOQUEO =
  'No se puede dar de baja una cuenta con transacciones o reclamos en curso';

function propagarConflictoSerializable(error: unknown): never {
  const codigo =
    error && typeof error === 'object' && 'code' in error
      ? (error as { code?: string }).code
      : undefined;
  if (codigo === 'P2034') {
    throw new ConflictException(
      'La cuenta o sus reclamos cambiaron durante la operación. Actualiza la página e inténtalo nuevamente.',
    );
  }
  throw error;
}

@Injectable()
export class BajaService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(BAJA_BLOQUEOS_PORT)
    private readonly bloqueos: BajaBloqueosPort,
  ) {}

  async solicitar(
    usuarioId: string,
    dto: SolicitarBajaDto,
  ): Promise<{ message: string }> {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: usuarioId, deletedAt: null },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (usuario.estado === 'SOLICITUD_BAJA_PENDIENTE') {
      throw new ConflictException('Ya tenés una solicitud de baja en curso.');
    }

    if (!(await compare(dto.password, usuario.passwordHash))) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }

    try {
      await this.prisma.$transaction(
        async (tx) => {
          await this.asegurarSinBloqueos(usuarioId, tx);

          const actualizado = await tx.usuario.updateMany({
            where: {
              id: usuarioId,
              estado: usuario.estado,
              deletedAt: null,
            },
            data: { estado: 'SOLICITUD_BAJA_PENDIENTE' },
          });
          if (actualizado.count !== 1) {
            throw new ConflictException(
              'El estado de la cuenta cambió. Actualiza la página e inténtalo nuevamente.',
            );
          }

          await tx.solicitudBaja.create({
            data: {
              usuarioId,
              motivo: dto.motivo,
              estadoPrevioUsuario: usuario.estado,
            },
          });
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error: unknown) {
      propagarConflictoSerializable(error);
    }

    if (usuario.rol === 'COMERCIANTE') {
      await this.bloqueos.pausarOfertas(usuarioId);
    }

    return {
      message:
        'Solicitud de baja registrada. El equipo de soporte la revisará desde el Backoffice.',
    };
  }

  async listarSolicitudes(estado?: string) {
    const solicitudes = await this.prisma.solicitudBaja.findMany({
      where: estado ? { estado: estado as never } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        usuario: {
          select: {
            id: true,
            dni: true,
            nombre: true,
            apellido: true,
            email: true,
            telefono: true,
            rol: true,
            estado: true,
            createdAt: true,
            comercio: {
              select: {
                cuit: true,
                razonSocial: true,
                nombreFantasia: true,
              },
            },
          },
        },
      },
    });

    const resumenes = await this.bloqueos.obtenerResumenesCuentas(
      solicitudes.map((s) => s.usuarioId),
    );

    return solicitudes.map((s) => ({
      ...s,
      ...(resumenes.get(s.usuarioId) ?? {
        pedidosCompletados: 0,
        saldoTarifas: 0,
      }),
    }));
  }

  async aprobar(
    adminId: string,
    solicitudId: string,
  ): Promise<{ message: string }> {
    const solicitud = await this.obtenerPendiente(solicitudId);

    try {
      await this.prisma.$transaction(
        async (tx) => {
          await this.asegurarSinBloqueos(solicitud.usuarioId, tx);

          const reclamo = await tx.solicitudBaja.updateMany({
            where: { id: solicitudId, estado: 'PENDIENTE' },
            data: {
              estado: 'APROBADA',
              resueltoPorId: adminId,
              resueltoEn: new Date(),
            },
          });

          if (reclamo.count !== 1) {
            throw new ConflictException(
              'La solicitud ya fue resuelta por otro administrador',
            );
          }

          await tx.usuario.update({
            where: { id: solicitud.usuarioId },
            data: {
              deletedAt: new Date(),
              tokenVersion: { increment: 1 },
            },
          });

          await tx.comercio.updateMany({
            where: { userId: solicitud.usuarioId, estado: { not: 'ELIMINADO' } },
            data: { estado: 'ELIMINADO' },
          });
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error: unknown) {
      propagarConflictoSerializable(error);
    }

    // Las ofertas ya se pausaron al solicitar la baja; se reafirma por integridad.
    await this.bloqueos.pausarOfertas(solicitud.usuarioId);

    return {
      message:
        'Baja aprobada. La cuenta fue inactivada y todas sus sesiones cerradas.',
    };
  }

  async rechazar(
    adminId: string,
    solicitudId: string,
    dto: RechazarBajaDto,
  ): Promise<{ message: string }> {
    const solicitud = await this.obtenerPendiente(solicitudId);
    // Restaura el estado que tenía la cuenta al momento de solicitar la baja.
    const estadoRestaurado: EstadoUsuario =
      solicitud.estadoPrevioUsuario ?? 'HABILITADO';

    await this.prisma.$transaction(async (tx) => {
      // Reclamo atómico: solo un administrador puede resolver la solicitud.
      const reclamo = await tx.solicitudBaja.updateMany({
        where: { id: solicitudId, estado: 'PENDIENTE' },
        data: {
          estado: 'RECHAZADA',
          observaciones: dto.observaciones,
          resueltoPorId: adminId,
          resueltoEn: new Date(),
        },
      });

      if (reclamo.count !== 1) {
        throw new ConflictException(
          'La solicitud ya fue resuelta por otro administrador',
        );
      }

      await tx.usuario.update({
        where: { id: solicitud.usuarioId },
        data: { estado: estadoRestaurado },
      });
    });

    await this.bloqueos.reactivarOfertas(solicitud.usuarioId);

    return { message: 'Solicitud de baja rechazada.' };
  }

  private async obtenerPendiente(solicitudId: string) {
    const solicitud = await this.prisma.solicitudBaja.findUnique({
      where: { id: solicitudId },
    });

    if (!solicitud || solicitud.estado !== 'PENDIENTE') {
      throw new NotFoundException(
        'La solicitud de baja no existe o ya fue resuelta',
      );
    }

    return solicitud;
  }

  private async asegurarSinBloqueos(
    usuarioId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const bloqueos: BloqueoBaja[] = await this.bloqueos.obtenerBloqueos(
      usuarioId,
      tx,
    );

    if (bloqueos.length > 0) {
      throw new BadRequestException({
        message: MSG_BLOQUEO,
        bloqueos,
      });
    }
  }
}
