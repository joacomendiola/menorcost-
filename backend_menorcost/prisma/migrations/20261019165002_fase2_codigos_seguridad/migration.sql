-- CreateEnum
CREATE TYPE "TipoCodigo" AS ENUM ('VERIFICACION_EMAIL', 'RECUPERACION_PASSWORD');

-- CreateTable
CREATE TABLE "codigos_seguridad" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoCodigo" NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "usadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigos_seguridad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "codigos_seguridad_usuarioId_tipo_idx" ON "codigos_seguridad"("usuarioId", "tipo");

-- CreateIndex
CREATE INDEX "codigos_seguridad_codigoHash_idx" ON "codigos_seguridad"("codigoHash");

-- AddForeignKey
ALTER TABLE "codigos_seguridad" ADD CONSTRAINT "codigos_seguridad_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
