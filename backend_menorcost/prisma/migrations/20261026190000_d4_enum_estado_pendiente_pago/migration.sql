-- AlterEnum
-- Se separa en su propia migración porque PostgreSQL no permite usar un valor
-- nuevo de un ENUM dentro de la misma transacción en la que se agrega.
ALTER TYPE "EstadoPedido" ADD VALUE 'PENDIENTE_PAGO';
