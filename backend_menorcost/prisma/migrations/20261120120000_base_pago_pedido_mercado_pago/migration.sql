-- Base para el pago real con Mercado Pago (Orders API).
-- Un `Pago` representa un intento de pago; la orden de MP vive en el intento.

-- AlterTable
ALTER TABLE "pagos" ADD COLUMN     "mp_order_id" VARCHAR(64),
ADD COLUMN     "mp_status" VARCHAR(40),
ADD COLUMN     "mp_status_detail" VARCHAR(80);

-- CreateTable
CREATE TABLE "notificaciones_mercadopago" (
    "id" UUID NOT NULL,
    "clave_unica" VARCHAR(120) NOT NULL,
    "topico" VARCHAR(40) NOT NULL,
    "accion" VARCHAR(60),
    "id_recurso" VARCHAR(80),
    "referencia_externa" VARCHAR(80),
    "payload" JSONB,
    "recibida_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "procesada_en" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "notificaciones_mercadopago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notificaciones_mercadopago_clave_unica_key" ON "notificaciones_mercadopago"("clave_unica");

-- CreateIndex
CREATE INDEX "notificaciones_mercadopago_recibida_en_idx" ON "notificaciones_mercadopago"("recibida_en");

-- CreateIndex
CREATE INDEX "notificaciones_mercadopago_topico_idx" ON "notificaciones_mercadopago"("topico");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_mp_order_id_key" ON "pagos"("mp_order_id");
