-- CreateEnum
CREATE TYPE "EstadoReporte" AS ENUM ('PENDIENTE_REVISION', 'BAJO_INVESTIGACION', 'RESUELTO', 'DESESTIMADO');

-- CreateEnum
CREATE TYPE "TipoDestinoReporte" AS ENUM ('COMERCIO', 'CLIENTE');

-- CreateTable
CREATE TABLE "calificacion" (
    "id_calificacion" SERIAL NOT NULL,
    "puntaje" INTEGER NOT NULL,
    "comentario" VARCHAR(250),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_pedido" TEXT NOT NULL,

    CONSTRAINT "calificacion_pkey" PRIMARY KEY ("id_calificacion")
);

-- CreateTable
CREATE TABLE "reporte" (
    "id_reporte" SERIAL NOT NULL,
    "motivo" TEXT NOT NULL,
    "descripcion" VARCHAR(300),
    "estado_reporte" "EstadoReporte" NOT NULL DEFAULT 'PENDIENTE_REVISION',
    "tipo_destino" "TipoDestinoReporte" NOT NULL,
    "fecha_reporte" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_resolucion" TIMESTAMP(3),
    "id_pedido" TEXT NOT NULL,
    "id_emisor" TEXT NOT NULL,
    "id_denunciado" TEXT NOT NULL,
    "id_admin" TEXT,

    CONSTRAINT "reporte_pkey" PRIMARY KEY ("id_reporte")
);

-- CreateTable
CREATE TABLE "pedido" (
    "id_pedido" TEXT NOT NULL,

    CONSTRAINT "pedido_pkey" PRIMARY KEY ("id_pedido")
);

-- CreateIndex
CREATE UNIQUE INDEX "calificacion_id_pedido_key" ON "calificacion"("id_pedido");

-- AddForeignKey
ALTER TABLE "calificacion" ADD CONSTRAINT "calificacion_id_pedido_fkey" FOREIGN KEY ("id_pedido") REFERENCES "pedido"("id_pedido") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte" ADD CONSTRAINT "reporte_id_pedido_fkey" FOREIGN KEY ("id_pedido") REFERENCES "pedido"("id_pedido") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte" ADD CONSTRAINT "reporte_id_emisor_fkey" FOREIGN KEY ("id_emisor") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte" ADD CONSTRAINT "reporte_id_denunciado_fkey" FOREIGN KEY ("id_denunciado") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte" ADD CONSTRAINT "reporte_id_admin_fkey" FOREIGN KEY ("id_admin") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
