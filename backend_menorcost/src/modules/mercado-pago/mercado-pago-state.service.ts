import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MercadoPagoConfigService } from './mercado-pago.config.js';
import { MercadoPagoOauthError } from './mercado-pago.errors.js';

const AUDIENCIA = 'mp-oauth';
const EMISOR = 'menorcost';
const VIGENCIA_MINUTOS = 10;

interface PayloadState {
  sub: string;
  comercioId: string;
  nonce: string;
  aud: string;
  iss: string;
}

export interface EstadoOauthConsumido {
  usuarioId: string;
  comercioId: string;
  codeVerifier?: string;
}

/**
 * `state` de OAuth: JWT firmado (integridad) + fila en `mp_oauth_state`
 * (nonce de un solo uso y code_verifier de PKCE).
 */
@Injectable()
export class MercadoPagoStateService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: MercadoPagoConfigService,
  ) {}

  async crear(
    usuarioId: string,
    comercioId: string,
    codeVerifier?: string,
  ): Promise<string> {
    const nonce = randomBytes(24).toString('base64url');
    const expiraEn = new Date(Date.now() + VIGENCIA_MINUTOS * 60_000);

    await this.prisma.mpOauthState.deleteMany({
      where: { expiraEn: { lt: new Date() } },
    });

    await this.prisma.mpOauthState.create({
      data: {
        nonce,
        usuarioId,
        comercioId,
        codeVerifier: codeVerifier ?? null,
        expiraEn,
      },
    });

    return this.jwt.signAsync(
      { sub: usuarioId, comercioId, nonce },
      {
        secret: this.config.stateSecret(),
        audience: AUDIENCIA,
        issuer: EMISOR,
        expiresIn: `${VIGENCIA_MINUTOS}m`,
      },
    );
  }

  async consumir(state: string): Promise<EstadoOauthConsumido> {
    let payload: PayloadState;

    try {
      payload = await this.jwt.verifyAsync<PayloadState>(state, {
        secret: this.config.stateSecret(),
        audience: AUDIENCIA,
        issuer: EMISOR,
      });
    } catch {
      throw new MercadoPagoOauthError(
        'state_invalido',
        'La solicitud de vinculación venció o no es válida. Volvé a intentar.',
      );
    }

    const registro = await this.prisma.mpOauthState.findUnique({
      where: { nonce: payload.nonce },
    });

    if (
      !registro ||
      registro.usadoEn ||
      registro.expiraEn.getTime() <= Date.now()
    ) {
      throw new MercadoPagoOauthError(
        'state_invalido',
        'La solicitud de vinculación venció o ya fue usada. Volvé a intentar.',
      );
    }

    const marcado = await this.prisma.mpOauthState.updateMany({
      where: {
        nonce: payload.nonce,
        usadoEn: null,
        expiraEn: { gt: new Date() },
      },
      data: { usadoEn: new Date() },
    });

    if (marcado.count === 0) {
      throw new MercadoPagoOauthError(
        'state_invalido',
        'La solicitud de vinculación venció o ya fue usada. Volvé a intentar.',
      );
    }

    return {
      usuarioId: registro.usuarioId,
      comercioId: registro.comercioId,
      codeVerifier: registro.codeVerifier ?? undefined,
    };
  }
}
