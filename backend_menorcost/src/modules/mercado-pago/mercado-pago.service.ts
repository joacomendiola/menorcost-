import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { MercadoPagoClient } from './mercado-pago.client.js';
import { MercadoPagoConfigService } from './mercado-pago.config.js';
import { MercadoPagoCryptoService } from './mercado-pago-crypto.service.js';
import { MercadoPagoOauthError } from './mercado-pago.errors.js';
import {
  calcularCodeChallenge,
  generarCodeVerifier,
} from './mercado-pago-pkce.js';
import { MercadoPagoStateService } from './mercado-pago-state.service.js';

const URL_AUTORIZACION = 'https://auth.mercadopago.com/authorization';

export interface CallbackOauth {
  code?: string;
  state?: string;
  error?: string;
}

export interface EstadoVinculacion {
  vinculado: boolean;
  estadoCredencial: 'ACTIVA' | 'REVOCADA' | 'EXPIRADA' | null;
  fechaVinculacion: string | null;
  scope: string | null;
  liveMode: boolean | null;
}

@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: MercadoPagoConfigService,
    private readonly state: MercadoPagoStateService,
    private readonly client: MercadoPagoClient,
    private readonly crypto: MercadoPagoCryptoService,
  ) {}

  async crearUrlAutorizacion(
    usuario: AuthenticatedUser,
  ): Promise<{ url: string }> {
    await this.validarUsuario(usuario);
    const comercio = await this.obtenerComercio(usuario.id);

    if (comercio.estado !== 'HABILITADO') {
      throw new MercadoPagoOauthError(
        'comercio_no_habilitado',
        'Tu comercio todavía no está habilitado. Una vez aprobado vas a poder vincular Mercado Pago.',
      );
    }

    const credencial = await this.prisma.credencialMp.findUnique({
      where: { comercioId: comercio.idComercio },
      select: { estado: true },
    });

    if (credencial?.estado === 'ACTIVA') {
      throw new MercadoPagoOauthError(
        'ya_vinculado',
        'Tu comercio ya tiene una cuenta de Mercado Pago vinculada. Desvinculala primero si querés cambiarla.',
      );
    }

    const codeVerifier = this.config.pkceHabilitado()
      ? generarCodeVerifier()
      : undefined;
    const state = await this.state.crear(
      usuario.id,
      comercio.idComercio,
      codeVerifier,
    );

    const url = new URL(URL_AUTORIZACION);
    url.searchParams.set('client_id', this.config.clientId());
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('platform_id', 'mp');
    url.searchParams.set('state', state);
    url.searchParams.set('redirect_uri', this.config.redirectUri());

    if (codeVerifier) {
      url.searchParams.set(
        'code_challenge',
        calcularCodeChallenge(codeVerifier),
      );
      url.searchParams.set('code_challenge_method', 'S256');
    }

    return { url: url.toString() };
  }

  /** Intercambia el código y persiste la credencial. Devuelve el comercio vinculado. */
  async vincularDesdeCallback(callback: CallbackOauth): Promise<string> {
    if (callback.error) {
      throw new MercadoPagoOauthError(
        callback.error === 'access_denied' ? 'cancelado' : 'error_interno',
        callback.error === 'access_denied'
          ? 'Cancelaste la autorización en Mercado Pago.'
          : 'Mercado Pago no autorizó la vinculación.',
      );
    }

    if (!callback.code || !callback.state) {
      throw new MercadoPagoOauthError(
        'state_invalido',
        'La respuesta de Mercado Pago está incompleta.',
      );
    }

    const consumido = await this.state.consumir(callback.state);

    const comercio = await this.prisma.comercio.findUnique({
      where: { idComercio: consumido.comercioId },
      select: { userId: true, estado: true },
    });

    if (!comercio || comercio.userId !== consumido.usuarioId) {
      throw new MercadoPagoOauthError(
        'state_invalido',
        'La solicitud de vinculación no corresponde a tu comercio.',
      );
    }

    if (comercio.estado !== 'HABILITADO') {
      throw new MercadoPagoOauthError(
        'comercio_no_habilitado',
        'Tu comercio dejó de estar habilitado durante la vinculación.',
      );
    }

    const token = await this.client.intercambiarCodigo(
      callback.code,
      consumido.codeVerifier,
    );

    // La llamada externa queda fuera de la transacción: no se retiene una
    // conexión de PostgreSQL mientras se espera a Mercado Pago.
    const datos = {
      mpUserId: token.userId,
      accessToken: this.crypto.cifrar(token.accessToken),
      refreshToken: this.crypto.cifrar(token.refreshToken),
      scope: token.scope,
      liveMode: token.liveMode,
      fechaTokenExpiration: new Date(Date.now() + token.expiresIn * 1000),
      fechaVinculacion: new Date(),
      estado: 'ACTIVA' as const,
    };

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.credencialMp.upsert({
          where: { comercioId: consumido.comercioId },
          create: { comercioId: consumido.comercioId, ...datos },
          update: datos,
        });

        await tx.comercio.update({
          where: { idComercio: consumido.comercioId },
          data: { mercadoPagoVinculado: true },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new MercadoPagoOauthError(
          'cuenta_mp_en_uso',
          'Esa cuenta de Mercado Pago ya está vinculada a otro comercio.',
        );
      }

      this.logger.error(
        'Falló el guardado de la credencial de Mercado Pago',
        error instanceof Error ? error.message : undefined,
      );
      throw new MercadoPagoOauthError(
        'error_interno',
        'No pudimos guardar la vinculación. Volvé a intentar el proceso.',
      );
    }

    return consumido.comercioId;
  }

  /** Desvincula y elimina la credencial (incluidos los tokens cifrados). */
  async desconectar(usuario: AuthenticatedUser): Promise<void> {
    const comercio = await this.obtenerComercio(usuario.id);

    await this.prisma.$transaction(async (tx) => {
      await tx.credencialMp.deleteMany({
        where: { comercioId: comercio.idComercio },
      });

      await tx.comercio.update({
        where: { idComercio: comercio.idComercio },
        data: { mercadoPagoVinculado: false },
      });
    });
  }

  async obtenerEstado(usuario: AuthenticatedUser): Promise<EstadoVinculacion> {
    const comercio = await this.obtenerComercio(usuario.id);
    const credencial = await this.prisma.credencialMp.findUnique({
      where: { comercioId: comercio.idComercio },
      select: {
        estado: true,
        fechaVinculacion: true,
        scope: true,
        liveMode: true,
      },
    });

    return {
      vinculado: credencial?.estado === 'ACTIVA',
      estadoCredencial: credencial?.estado ?? null,
      fechaVinculacion: credencial?.fechaVinculacion.toISOString() ?? null,
      scope: credencial?.scope ?? null,
      liveMode: credencial?.liveMode ?? null,
    };
  }

  private async validarUsuario(usuario: AuthenticatedUser): Promise<void> {
    if (usuario.estado !== 'HABILITADO') {
      throw new MercadoPagoOauthError(
        'usuario_no_habilitado',
        'Tu cuenta todavía no está habilitada para vincular Mercado Pago.',
      );
    }
  }

  private async obtenerComercio(usuarioId: string) {
    const comercio = await this.prisma.comercio.findUnique({
      where: { userId: usuarioId },
      select: { idComercio: true, estado: true },
    });

    if (!comercio) {
      throw new MercadoPagoOauthError(
        'sin_comercio',
        'Todavía no registraste tu comercio.',
      );
    }

    return comercio;
  }
}
