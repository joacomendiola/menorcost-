import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { CambiarPasswordDto } from './dto/cambiar-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() usuario: AuthenticatedUser): AuthenticatedUser {
    return usuario;
  }

  @Patch('password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  cambiarPassword(
    @CurrentUser() usuario: AuthenticatedUser,
    @Body() dto: CambiarPasswordDto,
  ) {
    return this.authService.cambiarPassword(usuario.id, dto);
  }
}
