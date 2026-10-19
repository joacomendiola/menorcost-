import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const extensions: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

@Injectable()
export class ImageStorageService {
  private readonly directory = resolve(
    process.env.UPLOAD_DIR ?? 'uploads',
  );

  async save(buffer: Buffer, mimeType: string): Promise<string> {
    const extension = extensions[mimeType];

    if (!extension) {
      throw new BadRequestException('Formato de imagen no permitido');
    }

    await mkdir(this.directory, { recursive: true });

    const filename = `${randomUUID()}${extension}`;
    await writeFile(join(this.directory, filename), buffer, { flag: 'wx' });

    return `/uploads/${filename}`;
  }

  async delete(imageUrl: string): Promise<void> {
    const filename = imageUrl.replace(/^\/uploads\//, '');

    if (!filename || filename.includes('/') || filename.includes('\\')) {
      throw new BadRequestException('Referencia de imagen no válida');
    }

    await rm(join(this.directory, filename), { force: true });
  }
}