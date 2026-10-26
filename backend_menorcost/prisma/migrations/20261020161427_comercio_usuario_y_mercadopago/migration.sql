/*
  Warnings:

  - A unique constraint covering the columns `[usuario_id]` on the table `comercio` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `usuario_id` to the `comercio` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "comercio" ADD COLUMN     "mercado_pago_vinculado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "usuario_id" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "comercio_usuario_id_key" ON "comercio"("usuario_id");

-- AddForeignKey
ALTER TABLE "comercio" ADD CONSTRAINT "comercio_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
