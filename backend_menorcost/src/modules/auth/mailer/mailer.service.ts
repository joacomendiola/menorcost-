import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  EnvioCorreo,
  MailerProvider,
  ProveedorCorreo,
} from './mailer.interface.js';
import { ConsoleMailerProvider } from './providers/console-mailer.provider.js';
import { GmailMailerProvider } from './providers/gmail-mailer.provider.js';
import { SmtpMailerProvider } from './providers/smtp-mailer.provider.js';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly provider: MailerProvider;

  constructor(private readonly config: ConfigService) {
    this.provider = this.crearProvider();
    this.logger.log(`Proveedor de correo activo: ${this.nombreProvider}`);
  }

  enviar(correo: EnvioCorreo): Promise<void> {
    return this.provider.enviar(correo);
  }

  private get nombreProvider(): ProveedorCorreo {
    return (this.config.get<string>('MAIL_PROVIDER') as ProveedorCorreo) ?? 'console';
  }

  private crearProvider(): MailerProvider {
    switch (this.nombreProvider) {
      case 'smtp':
        return new SmtpMailerProvider(this.config);
      case 'gmail':
        return new GmailMailerProvider(this.config);
      default:
        return new ConsoleMailerProvider();
    }
  }
}
