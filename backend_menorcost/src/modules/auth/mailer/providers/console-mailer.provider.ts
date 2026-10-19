import { Logger } from '@nestjs/common';
import type { EnvioCorreo, MailerProvider } from '../mailer.interface.js';

export class ConsoleMailerProvider implements MailerProvider {
  private readonly logger = new Logger('MailerLocal');

  async enviar({ to, subject, html, text }: EnvioCorreo): Promise<void> {
    const cuerpo = text ?? html;
    this.logger.log(`Correo generado para <${to}>`);

    // Salida en consola para probar los flujos sin servidor de correos externo.
    console.log('');
    console.log('==================== CORREO (MODO LOCAL) ====================');
    console.log(`Para:    ${to}`);
    console.log(`Asunto:  ${subject}`);
    console.log('------------------------------------------------------------');
    console.log(cuerpo);
    console.log('============================================================');
    console.log('');
  }
}
