import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import type { CodigoSeguridad } from '../../generated/prisma/client.js';
import type { TipoCodigo } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class CodigosService {
  constructor(private readonly prisma: PrismaService) {}

  generarCodigoNumerico(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  generarToken(): string {
    return randomBytes(32).toString('hex');
  }

  hash(valor: string): string {
    return createHash('sha256').update(valor).digest('hex');
  }

  async crear(
    usuarioId: string,
    tipo: TipoCodigo,
    valor: string,
    minutos: number,
  ): Promise<CodigoSeguridad> {
    await this.prisma.codigoSeguridad.updateMany({
      where: { usuarioId, tipo, usadoEn: null },
      data: { usadoEn: new Date() },
    });

    return this.prisma.codigoSeguridad.create({
      data: {
        usuarioId,
        tipo,
        codigoHash: this.hash(valor),
        expiraEn: new Date(Date.now() + minutos * 60_000),
      },
    });
  }

  async validarPorUsuario(
    usuarioId: string,
    tipo: TipoCodigo,
    valor: string,
  ): Promise<CodigoSeguridad | null> {
    const registro = await this.prisma.codigoSeguridad.findFirst({
      where: {
        usuarioId,
        tipo,
        usadoEn: null,
        expiraEn: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!registro || registro.codigoHash !== this.hash(valor)) {
      return null;
    }

    return registro;
  }

  async buscarPorToken(
    tipo: TipoCodigo,
    valor: string,
  ): Promise<CodigoSeguridad | null> {
    return this.prisma.codigoSeguridad.findFirst({
      where: {
        tipo,
        codigoHash: this.hash(valor),
        usadoEn: null,
        expiraEn: { gt: new Date() },
      },
    });
  }

  async consumir(id: string): Promise<void> {
    await this.prisma.codigoSeguridad.update({
      where: { id },
      data: { usadoEn: new Date() },
    });
  }
}
