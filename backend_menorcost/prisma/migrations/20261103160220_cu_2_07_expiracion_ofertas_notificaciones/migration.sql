-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('OFERTA_VENCIDA');

-- CreateTable
CREATE TABLE "auditoria_vencimiento_oferta" (
    "id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "comercio_id" UUID NOT NULL,
    "estado_anterior" "EstadoProducto" NOT NULL,
    "estado_nuevo" "EstadoProducto" NOT NULL,
    "fecha_vencimiento" DATE NOT NULL,
    "ejecutado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_vencimiento_oferta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacion" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "auditoria_vencimiento_id" UUID,
    "titulo" VARCHAR(160) NOT NULL,
    "mensaje" VARCHAR(500) NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auditoria_vencimiento_oferta_producto_id_key" ON "auditoria_vencimiento_oferta"("producto_id");

-- CreateIndex
CREATE INDEX "auditoria_vencimiento_oferta_comercio_id_ejecutado_en_idx" ON "auditoria_vencimiento_oferta"("comercio_id", "ejecutado_en");

-- CreateIndex
CREATE INDEX "auditoria_vencimiento_oferta_producto_id_ejecutado_en_idx" ON "auditoria_vencimiento_oferta"("producto_id", "ejecutado_en");

-- CreateIndex
CREATE UNIQUE INDEX "notificacion_auditoria_vencimiento_id_key" ON "notificacion"("auditoria_vencimiento_id");

-- CreateIndex
CREATE INDEX "notificacion_usuario_id_leida_created_at_idx" ON "notificacion"("usuario_id", "leida", "created_at");

-- AddForeignKey
ALTER TABLE "auditoria_vencimiento_oferta" ADD CONSTRAINT "auditoria_vencimiento_oferta_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id_producto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria_vencimiento_oferta" ADD CONSTRAINT "auditoria_vencimiento_oferta_comercio_id_fkey" FOREIGN KEY ("comercio_id") REFERENCES "comercio"("id_comercio") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_auditoria_vencimiento_id_fkey" FOREIGN KEY ("auditoria_vencimiento_id") REFERENCES "auditoria_vencimiento_oferta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
