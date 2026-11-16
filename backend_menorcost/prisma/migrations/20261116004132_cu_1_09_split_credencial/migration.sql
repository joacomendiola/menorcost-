-- AlterTable
ALTER TABLE "splits_pagos" ADD COLUMN     "id_credencial" UUID;

-- CreateIndex
CREATE INDEX "splits_pagos_id_credencial_idx" ON "splits_pagos"("id_credencial");

-- AddForeignKey
ALTER TABLE "splits_pagos" ADD CONSTRAINT "splits_pagos_id_credencial_fkey" FOREIGN KEY ("id_credencial") REFERENCES "credenciales_mp"("id_credencial") ON DELETE SET NULL ON UPDATE CASCADE;
