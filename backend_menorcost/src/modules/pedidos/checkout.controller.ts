import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { CheckoutService } from './checkout.service.js';
import { CrearPedidoDto } from './dto/crear-pedido.dto.js';

@Controller('checkout')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CLIENTE')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Get(':comercioId')
  obtenerResumen(
    @CurrentUser() usuario: AuthenticatedUser,
    @Param('comercioId', ParseUUIDPipe) comercioId: string,
  ) {
    return this.checkoutService.obtenerResumen(usuario.id, comercioId);
  }

  @Post()
  pagar(
    @CurrentUser() usuario: AuthenticatedUser,
    @Body() dto: CrearPedidoDto,
  ) {
    return this.checkoutService.pagar(usuario.id, dto);
  }
}
