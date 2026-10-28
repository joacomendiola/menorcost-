import { IsIn } from 'class-validator';
import type { ManageableOfferStatus } from '../ofertas-creation.ports.js';

export class UpdateOfertaStatusDto {
  @IsIn(['ACTIVO', 'PAUSADO', 'ELIMINADO'])
  estado!: ManageableOfferStatus;
}