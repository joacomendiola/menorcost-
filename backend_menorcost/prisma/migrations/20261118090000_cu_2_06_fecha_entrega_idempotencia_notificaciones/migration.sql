-- CU-2.06: fecha de entrega en mostrador
ALTER TABLE "pedido" ADD COLUMN     "fecha_entrega" TIMESTAMP(0);

-- Checkout idempotente: evita pedidos y cobros duplicados por doble click
ALTER TABLE "pedido" ADD COLUMN     "idempotency_key" VARCHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX "pedido_idempotency_key_key" ON "pedido"("idempotency_key");

-- Nuevos tipos de notificación de pedidos
ALTER TYPE "TipoNotificacion" ADD VALUE 'PEDIDO_ENTREGADO';
ALTER TYPE "TipoNotificacion" ADD VALUE 'PEDIDO_CANCELADO';
ALTER TYPE "TipoNotificacion" ADD VALUE 'PEDIDO_CANCELADO_POR_FALTA_RETIRO';
