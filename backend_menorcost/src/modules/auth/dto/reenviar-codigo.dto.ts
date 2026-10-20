import { IsEmail } from 'class-validator';

export class ReenviarCodigoDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  email!: string;
}
