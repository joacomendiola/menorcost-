import { createHash, randomBytes } from 'node:crypto';

/** Verificador PKCE: 43-128 caracteres base64url (RFC 7636). */
export function generarCodeVerifier(): string {
  return randomBytes(48).toString('base64url');
}

/** code_challenge = BASE64URL(SHA256(code_verifier)). */
export function calcularCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}
