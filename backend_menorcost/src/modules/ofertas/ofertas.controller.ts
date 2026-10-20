import {
  Body,
  Controller,
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { CreateOfferDto } from './dto/create-offer.dto.js';
import type { OfferRecord } from './ofertas-creation.ports.js';
import { OffersService } from './ofertas.service.js';

@Controller('offers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COMERCIANTE')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('imagen', {
      storage: memoryStorage(),
      limits: {
        files: 1,
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  create(
    @CurrentUser() usuario: AuthenticatedUser,
    @Body() dto: CreateOfferDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType: /^image\/(jpeg|png|webp)$/,
          }),
        ],
      }),
    )
    image: Express.Multer.File,
  ): Promise<OfferRecord> {
    return this.offersService.create(usuario.id, dto, {
      buffer: image.buffer,
      mimetype: image.mimetype,
    });
  }
}