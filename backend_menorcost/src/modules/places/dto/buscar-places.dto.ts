import { IsString, Length } from 'class-validator';

export class BuscarPlacesDto {
  @IsString()
  @Length(3, 120)
  texto!: string;
}
