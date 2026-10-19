import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ReenviarCodigoDto } from './dto/reenviar-codigo.dto.js';
import { RegistroDto } from './dto/registro.dto.js';
import { VerificarCuentaDto } from './dto/verificar-cuenta.dto.js';
import { RegistroService } from './registro.service.js';

@Controller('auth')
export class RegistroController {
  constructor(private readonly registroService: RegistroService) {}

  @Post('registro')
  registrar(@Body() dto: RegistroDto) {
    return this.registroService.registrar(dto);
  }

  @Post('verificar-cuenta')
  @HttpCode(HttpStatus.OK)
  verificarCuenta(@Body() dto: VerificarCuentaDto) {
    return this.registroService.verificarCuenta(dto);
  }

  @Post('reenviar-codigo')
  @HttpCode(HttpStatus.OK)
  reenviarCodigo(@Body() dto: ReenviarCodigoDto) {
    return this.registroService.reenviarCodigo(dto);
  }
}
