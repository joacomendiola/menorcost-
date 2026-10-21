/*
  Warnings:

  - Added the required column `comercioId` to the `pedido` table without a default value. This is not possible if the table is not empty.
  - Added the required column `estado` to the `pedido` table without a default value. This is not possible if the table is not empty.
  - Added the required column `usuarioId` to the `pedido` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "comercio" ADD COLUMN     "reputacion_promedio" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "total_calificaciones" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "pedido" ADD COLUMN     "comercioId" UUID NOT NULL,
ADD COLUMN     "estado" TEXT NOT NULL,
ADD COLUMN     "usuarioId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
