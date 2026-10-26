/*
  Warnings:

  - The primary key for the `pedido` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `comercioId` on the `pedido` table. All the data in the column will be lost.
  - You are about to drop the column `usuarioId` on the `pedido` table. All the data in the column will be lost.
  - The `estado` column on the `pedido` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[codigo_qr]` on the table `pedido` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[codigo_alfanumerico]` on the table `pedido` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `id_pedido` on the `calificacion` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `codigo_alfanumerico` to the `pedido` table without a default value. This is not possible if the table is not empty.
  - Added the required column `codigo_qr` to the `pedido` table without a default value. This is not possible if the table is not empty.
  - Added the required column `id_comercio` to the `pedido` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtotal` to the `pedido` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tarifa_servicio` to the `pedido` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total` to the `pedido` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `pedido` table without a default value. This is not possible if the table is not empty.
  - Added the required column `usuario_id` to the `pedido` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id_pedido` on the `pedido` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id_pedido` on the `reporte` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('PENDIENTE_DE_RETIRO', 'ENTREGADO', 'CANCELADO', 'CANCELADO_POR_FALTA_RETIRO');

-- DropForeignKey
ALTER TABLE "calificacion" DROP CONSTRAINT "calificacion_id_pedido_fkey";

-- DropForeignKey
ALTER TABLE "pedido" DROP CONSTRAINT "pedido_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "reporte" DROP CONSTRAINT "reporte_id_pedido_fkey";

-- AlterTable
ALTER TABLE "calificacion" DROP COLUMN "id_pedido",
ADD COLUMN     "id_pedido" UUID NOT NULL;

-- AlterTable
ALTER TABLE "pedido" DROP CONSTRAINT "pedido_pkey",
DROP COLUMN "comercioId",
DROP COLUMN "usuarioId",
ADD COLUMN     "codigo_alfanumerico" VARCHAR(20) NOT NULL,
ADD COLUMN     "codigo_qr" VARCHAR(100) NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "fecha_pedido" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "franja_horario_id" UUID,
ADD COLUMN     "id_comercio" UUID NOT NULL,
ADD COLUMN     "subtotal" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "tarifa_servicio" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "total" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "usuario_id" TEXT NOT NULL,
DROP COLUMN "id_pedido",
ADD COLUMN     "id_pedido" UUID NOT NULL,
DROP COLUMN "estado",
ADD COLUMN     "estado" "EstadoPedido" NOT NULL DEFAULT 'PENDIENTE_DE_RETIRO',
ADD CONSTRAINT "pedido_pkey" PRIMARY KEY ("id_pedido");

-- AlterTable
ALTER TABLE "reporte" DROP COLUMN "id_pedido",
ADD COLUMN     "id_pedido" UUID NOT NULL;

-- CreateTable
CREATE TABLE "pedido_item" (
    "id_pedido_item" UUID NOT NULL,
    "id_pedido" UUID NOT NULL,
    "id_producto" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "pedido_item_pkey" PRIMARY KEY ("id_pedido_item")
);

-- CreateIndex
CREATE UNIQUE INDEX "calificacion_id_pedido_key" ON "calificacion"("id_pedido");

-- CreateIndex
CREATE UNIQUE INDEX "pedido_codigo_qr_key" ON "pedido"("codigo_qr");

-- CreateIndex
CREATE UNIQUE INDEX "pedido_codigo_alfanumerico_key" ON "pedido"("codigo_alfanumerico");

-- AddForeignKey
ALTER TABLE "calificacion" ADD CONSTRAINT "calificacion_id_pedido_fkey" FOREIGN KEY ("id_pedido") REFERENCES "pedido"("id_pedido") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte" ADD CONSTRAINT "reporte_id_pedido_fkey" FOREIGN KEY ("id_pedido") REFERENCES "pedido"("id_pedido") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_id_comercio_fkey" FOREIGN KEY ("id_comercio") REFERENCES "comercio"("id_comercio") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_item" ADD CONSTRAINT "pedido_item_id_pedido_fkey" FOREIGN KEY ("id_pedido") REFERENCES "pedido"("id_pedido") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_item" ADD CONSTRAINT "pedido_item_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "producto"("id_producto") ON DELETE RESTRICT ON UPDATE CASCADE;
