-- DropForeignKey
-- La comisión histórica se guarda en pedido (tasa y monto), sin relación a config_comision.
ALTER TABLE "pedido" DROP CONSTRAINT "pedido_id_config_comision_fkey";

-- AlterTable
ALTER TABLE "pedido" DROP COLUMN "id_config_comision";

-- AddForeignKey
-- Integridad referencial de la franja de retiro elegida para el pedido (CU-3.03).
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_franja_horario_id_fkey" FOREIGN KEY ("franja_horario_id") REFERENCES "franja_retiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
