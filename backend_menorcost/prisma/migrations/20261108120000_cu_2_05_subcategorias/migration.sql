-- AlterTable
ALTER TABLE "categoria" ADD COLUMN "categoria_padre_id" UUID;

-- CreateIndex
CREATE INDEX "categoria_categoria_padre_id_idx" ON "categoria"("categoria_padre_id");

-- AddForeignKey
ALTER TABLE "categoria" ADD CONSTRAINT "categoria_categoria_padre_id_fkey" FOREIGN KEY ("categoria_padre_id") REFERENCES "categoria"("id_categoria") ON DELETE RESTRICT ON UPDATE CASCADE;
