import { Module } from '@nestjs/common';
import { BackofficeController } from './backoffice.controller.js';
import { BackofficeService } from './backoffice.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [BackofficeController],
  providers: [BackofficeService],
  exports: [BackofficeService],
})
export class BackofficeModule {}