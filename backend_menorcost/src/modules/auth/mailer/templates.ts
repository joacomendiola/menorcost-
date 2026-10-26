export interface CorreoGenerado {
  subject: string;
  html: string;
  text: string;
}

export function correoVerificacion(codigo: string, minutos: number): CorreoGenerado {
  return {
    subject: 'Verificá tu cuenta de Menorcost',
    text: [
      '¡Bienvenido a Menorcost!',
      '',
      `Tu código de verificación es: ${codigo}`,
      `Expira en ${minutos} minutos.`,
      '',
      'Si no creaste una cuenta, ignorá este mensaje.',
    ].join('\n'),
    html: [
      '<h2>¡Bienvenido a Menorcost!</h2>',
      '<p>Tu código de verificación es:</p>',
      `<p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${codigo}</p>`,
      `<p>Expira en ${minutos} minutos.</p>`,
      '<p>Si no creaste una cuenta, ignorá este mensaje.</p>',
    ].join('\n'),
  };
}

export function correoRecuperacion(enlace: string, minutos: number): CorreoGenerado {
  return {
    subject: 'Restablecé tu contraseña de Menorcost',
    text: [
      'Recibimos una solicitud para restablecer tu contraseña.',
      '',
      `Enlace de restablecimiento: ${enlace}`,
      `El enlace expira en ${minutos} minutos.`,
      '',
      'Si no solicitaste este cambio, ignorá este mensaje.',
    ].join('\n'),
    html: [
      '<h2>Restablecimiento de contraseña</h2>',
      '<p>Recibimos una solicitud para restablecer tu contraseña.</p>',
      `<p><a href="${enlace}">Restablecer contraseña</a></p>`,
      `<p>El enlace expira en ${minutos} minutos.</p>`,
      '<p>Si no solicitaste este cambio, ignorá este mensaje.</p>',
    ].join('\n'),
  };
}
