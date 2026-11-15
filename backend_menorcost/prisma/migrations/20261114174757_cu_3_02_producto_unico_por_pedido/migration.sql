/*
  Warnings:

  - You are about to drop the column `subtotal` on the `canasta` table. All the data in the column will be lost.
  - You are about to drop the column `precio_menorcost` on the `producto` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[id_pedido,id_producto]` on the table `pedido_item` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `comision_menorcost_tasa_aplicada` to the `producto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `precio_base_neto` to the `producto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `precio_publico` to the `producto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tasa_mp_estimada_aplicada` to the `producto` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "pedido_item" DROP CONSTRAINT "pedido_item_id_pedido_fkey";

-- DropIndex
DROP INDEX "auditoria_vencimiento_oferta_producto_id_key";

-- DropIndex
DROP INDEX "canasta_usuario_id_idx";

-- DropIndex
DROP INDEX "pedido_id_comercio_idx";

-- DropIndex
DROP INDEX "pedido_usuario_id_idx";

-- AlterTable
ALTER TABLE "canasta" DROP COLUMN "subtotal";

-- CreateIndex
CREATE INDEX "canasta_usuario_id_updated_at_idx" ON "canasta"("usuario_id", "updated_at");

-- CreateIndex
CREATE INDEX "pedido_usuario_id_estado_idx" ON "pedido"("usuario_id", "estado");

-- CreateIndex
CREATE INDEX "pedido_id_comercio_estado_idx" ON "pedido"("id_comercio", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "pedido_item_id_pedido_id_producto_key" ON "pedido_item"("id_pedido", "id_producto");

-- CreateIndex
CREATE INDEX "producto_id_comercio_estado_idx" ON "producto"("id_comercio", "estado");

-- CreateIndex
CREATE INDEX "producto_fecha_vencimiento_estado_idx" ON "producto"("fecha_vencimiento", "estado");

-- AddForeignKey
ALTER TABLE "pedido_item" ADD CONSTRAINT "pedido_item_id_pedido_fkey" FOREIGN KEY ("id_pedido") REFERENCES "pedido"("id_pedido") ON DELETE CASCADE ON UPDATE CASCADE;
