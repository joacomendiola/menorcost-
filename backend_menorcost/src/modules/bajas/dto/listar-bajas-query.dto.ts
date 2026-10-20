import { IsEnum, IsOptional } from 'class-validator';
import { EstadoSolicitudBaja } from '../../../generated/prisma/enums.js';

export class ListarBajasQueryDto {
  @IsOptional()
  @IsEnum(EstadoSolicitudBaja, {
    message: 'El estado debe ser PENDIENTE, APROBADA o RECHAZADA',
  })
  estado?: EstadoSolicitudBaja;
}
