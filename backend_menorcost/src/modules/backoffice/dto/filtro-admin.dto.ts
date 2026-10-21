import { IsOptional, IsString } from 'class-validator';

export class FiltroAdminDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  estado?: string;
}