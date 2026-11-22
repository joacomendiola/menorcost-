-- Completa el modelo de pago real con Mercado Pago (Orders API + Split Payment).
-- Agrega la auditoría de la reserva de stock, el motivo de cancelación, la
-- credencial usada por cada intento de pago y los encabezados del webhook.

-- AlterTable
ALTER TABLE "notificaciones_mercadopago" ADD COLUMN     "encabezados" JSONB;

-- AlterTable
ALTER TABLE "pagos" ADD COLUMN     "id_credencial" UUID;

-- AlterTable
ALTER TABLE "pedido" ADD COLUMN     "motivo_cancelacion" VARCHAR(40),
ADD COLUMN     "stock_liberado_en" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "pagos_id_credencial_idx" ON "pagos"("id_credencial");

-- CreateIndex
CREATE INDEX "pedido_estado_fecha_expiracion_pago_idx" ON "pedido"("estado", "fecha_expiracion_pago");

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_id_credencial_fkey" FOREIGN KEY ("id_credencial") REFERENCES "credenciales_mp"("id_credencial") ON DELETE SET NULL ON UPDATE CASCADE;
