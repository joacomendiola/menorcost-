import { Injectable, Logger } from '@nestjs/common';
import type { CredencialMp } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MercadoPagoCryptoService } from '../mercado-pago/mercado-pago-crypto.service.js';
import { ClienteMercadoPago } from './cliente-mercadopago.js';
import { ErrorPagoMercadoPago } from './error-pago-mercadopago.js';

/**
 * Se renueva el token un poco antes de que venza para que la llamada a
 * Mercado Pago no falle a mitad de un checkout.
 */
const MARGEN_RENOVACION_MS = 5 * 60 * 1000;

export interface CredencialParaCobro {
  idCredencial: string;
  accessToken: string;
}

type CredencialPersistida = Pick<
  CredencialMp,
  | 'idCredencial'
  | 'accessToken'
  | 'refreshToken'
  | 'fechaTokenExpiration'
  | 'estado'
>;

/**
 * Credencial OAuth del comercio lista para operar.
 *
 * Los tokens se guardan cifrados (AES-256-GCM) y se descifran solo en memoria.
 * Si el access token está por vencer se renueva con el refresh token; Mercado
 * Pago rota el refresh token en cada renovación, así que se persisten ambos.
 */
@Injectable()
export class CredencialMercadoPagoService {
  private readonly logger = new Logger(CredencialMercadoPagoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: MercadoPagoCryptoService,
    private readonly cliente: ClienteMercadoPago,
  ) {}

  async obtenerCredencialActiva(
    comercioId: string,
  ): Promise<CredencialParaCobro> {
    const credencial = await this.prisma.credencialMp.findUnique({
      where: { comercioId },
      select: {
        idCredencial: true,
        accessToken: true,
        refreshToken: true,
        fechaTokenExpiration: true,
        estado: true,
      },
    });

    if (!credencial || credencial.estado !== 'ACTIVA') {
      throw new ErrorPagoMercadoPago(
        'credencial_invalida',
        'El comercio no tiene una cuenta de Mercado Pago vinculada. Tiene que vincularla para recibir pagos.',
      );
    }

    const venceEn = credencial.fechaTokenExpiration.getTime() - Date.now();

    if (venceEn > MARGEN_RENOVACION_MS) {
      return {
        idCredencial: credencial.idCredencial,
        accessToken: this.crypto.descifrar(credencial.accessToken),
      };
    }

    return this.refrescar(credencial);
  }

  private async refrescar(
    credencial: CredencialPersistida,
  ): Promise<CredencialParaCobro> {
    let token: Awaited<ReturnType<ClienteMercadoPago['refrescarToken']>>;

    try {
      token = await this.cliente.refrescarToken(
        this.crypto.descifrar(credencial.refreshToken),
      );
    } catch (error) {
      // Solo una credencial rechazada queda inutilizable. Si Mercado Pago está
      // caído se conserva ACTIVA para poder reintentar en el próximo checkout.
      if (
        error instanceof ErrorPagoMercadoPago &&
        error.codigo === 'credencial_invalida'
      ) {
        await this.marcarExpirada(credencial.idCredencial);
      }

      throw error;
    }

    await this.prisma.credencialMp.update({
      where: { idCredencial: credencial.idCredencial },
      data: {
        accessToken: this.crypto.cifrar(token.access_token),
        refreshToken: this.crypto.cifrar(token.refresh_token),
        fechaTokenExpiration: new Date(Date.now() + token.expires_in * 1000),
      },
    });

    return {
      idCredencial: credencial.idCredencial,
      accessToken: token.access_token,
    };
  }

  private async marcarExpirada(idCredencial: string): Promise<void> {
    try {
      await this.prisma.credencialMp.update({
        where: { idCredencial },
        data: { estado: 'EXPIRADA' },
      });
    } catch (error) {
      this.logger.error(
        `No se pudo marcar como EXPIRADA la credencial ${idCredencial}.`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
