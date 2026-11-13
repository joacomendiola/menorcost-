import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const ESTADOS_ADMIN = [
  'PENDIENTE_VERIFICACION',
  'HABILITADO',
  'DOCUMENTACION_RECHAZADA',
  'SUSPENDIDO',
  'BAJO_INVESTIGACION',
  'SOLICITUD_BAJA_PENDIENTE',
  'PENDIENTE_REVISION',
  'RESUELTO',
  'DESESTIMADO',
  'todos',
];

export class FiltroAdminDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @IsIn(ESTADOS_ADMIN, {
    message: 'El estado no es válido para el panel de administración',
  })
  estado?: string;
}