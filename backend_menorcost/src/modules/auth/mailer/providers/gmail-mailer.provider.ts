import type { ConfigService } from '@nestjs/config';
import type { EnvioCorreo, MailerProvider } from '../mailer.interface.js';

/**
 * Placeholder para la integración con Gmail API.
 *
 * La interfaz `MailerProvider` ya define el contrato, por lo que conectar la
 * Gmail API solo requiere implementar `enviar()` usando las credenciales OAuth
 * y activar `MAIL_PROVIDER=gmail`.
 */
export class GmailMailerProvider implements MailerProvider {
  constructor(private readonly config: ConfigService) {
    void this.config;
  }

  enviar(_correo: EnvioCorreo): Promise<void> {
    return Promise.reject(
      new Error(
        'El proveedor Gmail API aún no está implementado. Usá MAIL_PROVIDER=console o MAIL_PROVIDER=smtp.',
      ),
    );
  }
}
