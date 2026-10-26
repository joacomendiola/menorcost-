import { IsEmail } from 'class-validator';

export class OlvidarPasswordDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  email!: string;
}
