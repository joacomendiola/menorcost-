import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { ValidarEntregaDto } from './dto/validar-entrega.dto.js';
import { PedidosService } from './pedidos.service.js';

/**
 * Historial y ticket del cliente (CU-3.03) + verificación de entrega en
 * mostrador (CU-2.06).
 *
 * `:codigo` acepta el código alfanumérico del ticket o el UUID del QR.
 */
@Controller('pedidos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  @Get()
  @Roles('CLIENTE')
  listar(@CurrentUser() usuario: AuthenticatedUser) {
    return this.pedidosService.listar(usuario.id);
  }

  /** Debe declararse antes de `:codigo` para no colisionar con la ruta. */
  @Get('comercio')
  @Roles('COMERCIANTE')
  listarComercio(@CurrentUser() usuario: AuthenticatedUser) {
    return this.pedidosService.listarComercio(usuario.id);
  }

  @Get(':codigo')
  @Roles('CLIENTE')
  obtenerPorCodigo(
    @CurrentUser() usuario: AuthenticatedUser,
    @Param('codigo') codigo: string,
  ) {
    return this.pedidosService.obtenerPorCodigo(usuario.id, codigo);
  }

  /** CU-2.06: valida el código sin entregar (paso previo en mostrador). */
  @Post('validar')
  @Roles('COMERCIANTE')
  validarEntrega(
    @CurrentUser() usuario: AuthenticatedUser,
    @Body() dto: ValidarEntregaDto,
  ) {
    return this.pedidosService.validarEntrega(usuario.id, dto.codigo);
  }

  /** CU-2.06: confirma la entrega y pasa el pedido a ENTREGADO. */
  @Post(':id/entregar')
  @Roles('COMERCIANTE')
  confirmarEntrega(
    @CurrentUser() usuario: AuthenticatedUser,
    @Param('id') idPedido: string,
  ) {
    return this.pedidosService.confirmarEntrega(usuario.id, idPedido);
  }

  /** Libera el stock de un pedido que quedó PENDIENTE_PAGO. */
  @Post(':id/cancelar')
  @Roles('COMERCIANTE')
  cancelar(
    @CurrentUser() usuario: AuthenticatedUser,
    @Param('id') idPedido: string,
  ) {
    return this.pedidosService.cancelarPendientePago(usuario.id, idPedido);
  }
}
