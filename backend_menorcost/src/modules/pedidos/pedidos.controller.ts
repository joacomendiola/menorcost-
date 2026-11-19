import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { PedidosService } from './pedidos.service.js';

/**
 * Historial y ticket del cliente (CU-3.03).
 *
 * `:codigo` acepta el código alfanumérico del ticket o el UUID del QR: el
 * mostrador puede validar cualquiera de los dos.
 */
@Controller('pedidos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CLIENTE')
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  @Get()
  listar(@CurrentUser() usuario: AuthenticatedUser) {
    return this.pedidosService.listar(usuario.id);
  }

  @Get(':codigo')
  obtenerPorCodigo(
    @CurrentUser() usuario: AuthenticatedUser,
    @Param('codigo') codigo: string,
  ) {
    return this.pedidosService.obtenerPorCodigo(usuario.id, codigo);
  }
}
