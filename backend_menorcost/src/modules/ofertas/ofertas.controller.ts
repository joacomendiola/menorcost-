import {
  Body,
  Controller,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Patch,
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
import { UpdateOfertaStatusDto } from './dto/update-oferta-status.dto.js';
import { CreateOfferDto } from './dto/create-oferta.dto.js';
import { UpdateOfferDto } from './dto/update-oferta.dto.js';
import type {
  OfferDetails,
  OfferRecord,
} from './ofertas-creation.ports.js';
import { OffersService } from './ofertas.service.js';

@Controller('offers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COMERCIANTE')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get()
  list(
    @CurrentUser() usuario: AuthenticatedUser,
  ): Promise<OfferDetails[]> {
    return this.offersService.listByOwner(usuario.id);
  }

  @Get(':offerId')
  getById(
    @CurrentUser() usuario: AuthenticatedUser,
    @Param('offerId', ParseUUIDPipe) offerId: string,
  ): Promise<OfferDetails> {
    return this.offersService.getByIdForOwner(usuario.id, offerId);
  }

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

  @Patch(':offerId')
  @UseInterceptors(
    FileInterceptor('imagen', {
      storage: memoryStorage(),
      limits: {
        files: 1,
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  update(
    @CurrentUser() usuario: AuthenticatedUser,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: UpdateOfferDto,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType: /^image\/(jpeg|png|webp)$/,
          }),
        ],
      }),
    )
    image?: Express.Multer.File,
  ): Promise<OfferDetails> {
    return this.offersService.update(
      usuario.id,
      offerId,
      dto,
      image
        ? {
            buffer: image.buffer,
            mimetype: image.mimetype,
          }
        : undefined,
    );
  }

  @Patch(':offerId/status')
  updateStatus(
    @CurrentUser() usuario: AuthenticatedUser,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: UpdateOfertaStatusDto,
  ): Promise<OfferDetails> {
    return this.offersService.updateStatus(
      usuario.id,
      offerId,
      dto.estado,
    );
  }
}