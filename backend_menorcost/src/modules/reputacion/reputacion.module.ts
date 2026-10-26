import { Module } from '@nestjs/common';
import { ReputacionController } from './reputacion.controller.js';
import { ReputacionService } from './reputacion.service.js';

@Module({
  controllers: [ReputacionController],
  providers: [ReputacionService],
  exports: [ReputacionService],
})
export class ReputacionModule {}