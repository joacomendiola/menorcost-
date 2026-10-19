import {
  Controller,
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
  UnauthorizedException,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { CreateOfferDto } from './dto/create-offer.dto.js';
import type { OfferRecord } from './offer-creation.ports.js';
import { OffersService } from './offers.service.js';

interface AuthenticatedRequest extends Request {
  user?: {
    id?: string;
  };
}

@Controller('offers')
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
    @Req() request: AuthenticatedRequest,
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
    const userId = request.user?.id;

    if (!userId) {
      throw new UnauthorizedException('Se requiere una sesión activa');
    }

    return this.offersService.create(userId, dto, {
      buffer: image.buffer,
      mimetype: image.mimetype,
    });
  }
}