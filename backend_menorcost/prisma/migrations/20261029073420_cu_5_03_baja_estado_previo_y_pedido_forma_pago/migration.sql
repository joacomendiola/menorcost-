-- AlterEnum
ALTER TYPE "EstadoComercio" ADD VALUE 'ELIMINADO';

-- AlterTable
ALTER TABLE "pedido" ADD COLUMN     "forma_pago" VARCHAR(30) NOT NULL DEFAULT 'MERCADO_PAGO';

-- AlterTable
ALTER TABLE "solicitudes_baja" ADD COLUMN     "estadoPrevioUsuario" "EstadoUsuario";
