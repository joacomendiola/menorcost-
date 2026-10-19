-- CreateEnum
CREATE TYPE "EstadoSolicitudBaja" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "solicitudes_baja" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "estado" "EstadoSolicitudBaja" NOT NULL DEFAULT 'PENDIENTE',
    "observaciones" TEXT,
    "resueltoPorId" TEXT,
    "resueltoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitudes_baja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitudes_baja_usuarioId_idx" ON "solicitudes_baja"("usuarioId");

-- CreateIndex
CREATE INDEX "solicitudes_baja_estado_idx" ON "solicitudes_baja"("estado");

-- AddForeignKey
ALTER TABLE "solicitudes_baja" ADD CONSTRAINT "solicitudes_baja_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_baja" ADD CONSTRAINT "solicitudes_baja_resueltoPorId_fkey" FOREIGN KEY ("resueltoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
