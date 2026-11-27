-- Guarda la URL de checkout devuelta por Mercado Pago para no reconstruirla
-- desde el order id en reintentos ni en la pantalla de resultado.

-- AlterTable
ALTER TABLE "pagos" ADD COLUMN     "mp_checkout_url" TEXT;
