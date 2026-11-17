-- AlterTable
ALTER TABLE "comercio" ADD COLUMN     "resuelto_por_id" TEXT,
ADD COLUMN     "resuelto_en" TIMESTAMP(3),
ADD COLUMN     "motivo_rechazo" VARCHAR(500);

-- AddForeignKey
ALTER TABLE "comercio" ADD CONSTRAINT "comercio_resuelto_por_id_fkey" FOREIGN KEY ("resuelto_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
