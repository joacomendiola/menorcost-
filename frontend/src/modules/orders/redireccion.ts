/**
 * Sale del SPA hacia una pantalla externa (el checkout de Mercado Pago).
 *
 * Se aísla en un módulo propio para poder mockearlo en los tests: jsdom no
 * permite espiar `window.location.assign` (la propiedad no es configurable).
 */
export function redirigirFueraDeLaApp(url: string): void {
  window.location.assign(url);
}
