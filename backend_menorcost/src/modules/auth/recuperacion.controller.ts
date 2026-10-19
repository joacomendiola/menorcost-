import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { OlvidarPasswordDto } from './dto/olvidar-password.dto.js';
import { RestablecerPasswordDto } from './dto/restablecer-password.dto.js';
import { RecuperacionService } from './recuperacion.service.js';

@Controller('auth')
export class RecuperacionController {
  constructor(private readonly recuperacionService: RecuperacionService) {}

  @Post('olvidar-password')
  @HttpCode(HttpStatus.OK)
  solicitar(@Body() dto: OlvidarPasswordDto) {
    return this.recuperacionService.solicitar(dto);
  }

  @Post('restablecer-password')
  @HttpCode(HttpStatus.OK)
  restablecer(@Body() dto: RestablecerPasswordDto) {
    return this.recuperacionService.restablecer(dto);
  }
}
