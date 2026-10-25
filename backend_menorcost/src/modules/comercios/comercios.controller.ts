import {
  Body,
  Controller,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  ParseFilePipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { ComerciosService } from './comercios.service.js';
import { ActualizarAperturaDto } from './dto/actualizar-apertura.dto.js';
import { ActualizarComercioDto } from './dto/actualizar-comercio.dto.js';
import { GuardarConfiguracionHorariaDto } from './dto/configuracion-horaria.dto.js';
import { CrearComercioDto } from './dto/crear-comercio.dto.js';
import { ReemplazarFranjasDto } from './dto/franja-retiro.dto.js';
import { ReemplazarHorariosDto } from './dto/horario-atencion.dto.js';

@Controller('comercios')
@UseGuards(JwtAuthGuard)
export class ComerciosController {
  constructor(private readonly comerciosService: ComerciosService) {}

  @Get('mio')
  obtenerMio(@CurrentUser() usuario: AuthenticatedUser) {
    return this.comerciosService.obtenerMio(usuario.id);
  }

  @Post()
  crear(
    @CurrentUser() usuario: AuthenticatedUser,
    @Body() dto: CrearComercioDto,
  ) {
    return this.comerciosService.crear(usuario.id, dto);
  }

  @Post('mio/logo')
  @UseInterceptors(
    FileInterceptor('imagen', {
      storage: memoryStorage(),
      limits: {
        files: 1,
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  subirLogo(
    @CurrentUser() usuario: AuthenticatedUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png)$/ }),
        ],
      }),
    )
    imagen: Express.Multer.File,
  ) {
    return this.comerciosService.subirImagen(usuario.id, 'logo', {
      buffer: imagen.buffer,
      mimetype: imagen.mimetype,
    });
  }

  @Post('mio/portada')
  @UseInterceptors(
    FileInterceptor('imagen', {
      storage: memoryStorage(),
      limits: {
        files: 1,
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  subirPortada(
    @CurrentUser() usuario: AuthenticatedUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png)$/ }),
        ],
      }),
    )
    imagen: Express.Multer.File,
  ) {
    return this.comerciosService.subirImagen(usuario.id, 'portada', {
      buffer: imagen.buffer,
      mimetype: imagen.mimetype,
    });
  }

  @Patch('mio')
  actualizarMio(
    @CurrentUser() usuario: AuthenticatedUser,
    @Body() dto: ActualizarComercioDto,
  ) {
    return this.comerciosService.actualizarMio(usuario.id, dto);
  }

  @Patch('mio/abierto')
  actualizarApertura(
    @CurrentUser() usuario: AuthenticatedUser,
    @Body() dto: ActualizarAperturaDto,
  ) {
    return this.comerciosService.actualizarApertura(usuario.id, dto);
  }

  @Get('mio/horarios')
  obtenerHorarios(@CurrentUser() usuario: AuthenticatedUser) {
    return this.comerciosService.obtenerHorarios(usuario.id);
  }

  @Put('mio/horarios')
  reemplazarHorarios(
    @CurrentUser() usuario: AuthenticatedUser,
    @Body() dto: ReemplazarHorariosDto,
  ) {
    return this.comerciosService.reemplazarHorarios(usuario.id, dto);
  }

  @Get('mio/franjas')
  obtenerFranjas(@CurrentUser() usuario: AuthenticatedUser) {
    return this.comerciosService.obtenerFranjas(usuario.id);
  }

  @Put('mio/franjas')
  reemplazarFranjas(
    @CurrentUser() usuario: AuthenticatedUser,
    @Body() dto: ReemplazarFranjasDto,
  ) {
    return this.comerciosService.reemplazarFranjas(usuario.id, dto);
  }

  @Put('mio/configuracion-horaria')
  reemplazarConfiguracionHoraria(
    @CurrentUser() usuario: AuthenticatedUser,
    @Body() dto: GuardarConfiguracionHorariaDto,
  ) {
    return this.comerciosService.reemplazarConfiguracionHoraria(
      usuario.id,
      dto,
    );
  }
}
