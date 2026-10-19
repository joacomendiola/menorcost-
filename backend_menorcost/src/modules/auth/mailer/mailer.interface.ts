export interface EnvioCorreo {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface MailerProvider {
  enviar(correo: EnvioCorreo): Promise<void>;
}

export type ProveedorCorreo = 'console' | 'smtp' | 'gmail';
