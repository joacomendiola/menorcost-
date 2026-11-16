import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Query,
  Redirect,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { MercadoPagoConfigService } from './mercado-pago.config.js';
import { MercadoPagoOauthError } from './mercado-pago.errors.js';
import { MercadoPagoService, type CallbackOauth } from './mercado-pago.service.js';

const ESTADOS_ERROR: Record<string, HttpStatus> = {
  ya_vinculado: HttpStatus.CONFLICT,
  cuenta_mp_en_uso: HttpStatus.CONFLICT,
  comercio_no_habilitado: HttpStatus.FORBIDDEN,
  usuario_no_habilitado: HttpStatus.FORBIDDEN,
  sin_comercio: HttpStatus.NOT_FOUND,
  state_invalido: HttpStatus.BAD_REQUEST,
  codigo_invalido: HttpStatus.BAD_REQUEST,
  cancelado: HttpStatus.BAD_REQUEST,
  mp_no_disponible: HttpStatus.SERVICE_UNAVAILABLE,
};

@Controller('mercadopago')
export class MercadoPagoController {
  private readonly logger = new Logger(MercadoPagoController.name);

  constructor(
    private readonly mercadoPago: MercadoPagoService,
    private readonly config: MercadoPagoConfigService,
  ) {}

  @Get('oauth/url')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COMERCIANTE')
  async urlAutorizacion(@CurrentUser() usuario: AuthenticatedUser) {
    try {
      return await this.mercadoPago.crearUrlAutorizacion(usuario);
    } catch (error) {
      throw this.aHttp(error);
    }
  }

  /**
   * Público a propósito: Mercado Pago redirige el navegador sin JWT.
   * La seguridad la da el `state` firmado y de un solo uso.
   */
  @Get('oauth/callback')
  @Redirect()
  async callback(@Query() query: CallbackOauth) {
    try {
      await this.mercadoPago.vincularDesdeCallback(query);
      return this.redirigir('ok');
    } catch (error) {
      if (!(error instanceof MercadoPagoOauthError)) {
        this.logger.error('Error inesperado en el callback de Mercado Pago');
      }
      const motivo =
        error instanceof MercadoPagoOauthError
          ? error.motivo
          : 'error_interno';
      return this.redirigir(motivo === 'cancelado' ? 'cancelado' : 'error', motivo);
    }
  }

  @Post('oauth/disconnect')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COMERCIANTE')
  async desconectar(@CurrentUser() usuario: AuthenticatedUser) {
    try {
      await this.mercadoPago.desconectar(usuario);
      return { mercadoPagoVinculado: false };
    } catch (error) {
      throw this.aHttp(error);
    }
  }

  @Get('status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COMERCIANTE')
  async estado(@CurrentUser() usuario: AuthenticatedUser) {
    try {
      return await this.mercadoPago.obtenerEstado(usuario);
    } catch (error) {
      throw this.aHttp(error);
    }
  }

  private redirigir(
    resultado: 'ok' | 'error' | 'cancelado',
    motivo?: string,
  ): { url: string; statusCode: number } {
    const url = new URL(`${this.config.frontendUrl()}/panel/mi-local`);
    url.searchParams.set('mp', resultado);
    if (motivo) {
      url.searchParams.set('motivo', motivo);
    }
    return { url: url.toString(), statusCode: HttpStatus.FOUND };
  }

  private aHttp(error: unknown): HttpException {
    if (error instanceof MercadoPagoOauthError) {
      return new HttpException(
        { message: error.message, motivo: error.motivo },
        ESTADOS_ERROR[error.motivo] ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    this.logger.error('Error inesperado en Mercado Pago');
    return new HttpException(
      { message: 'No pudimos completar la operación.', motivo: 'error_interno' },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
