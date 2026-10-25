-- CreateEnum
CREATE TYPE "EstadoComercio" AS ENUM ('PENDIENTE_VERIFICACION', 'HABILITADO', 'DOCUMENTACION_RECHAZADA', 'SUSPENDIDO');

-- AlterTable
ALTER TABLE "categoria" ADD COLUMN     "activa" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "nombre" VARCHAR(80) NOT NULL,
ADD COLUMN     "orden" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "slug" VARCHAR(80) NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "comercio" ADD COLUMN     "abierto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "calle" VARCHAR(120) NOT NULL,
ADD COLUMN     "codigo_postal" VARCHAR(10),
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "cuit" VARCHAR(13) NOT NULL,
ADD COLUMN     "descripcion" TEXT,
ADD COLUMN     "estado" "EstadoComercio" NOT NULL DEFAULT 'PENDIENTE_VERIFICACION',
ADD COLUMN     "google_place_id" VARCHAR(255) NOT NULL,
ADD COLUMN     "latitud" DECIMAL(9,6) NOT NULL,
ADD COLUMN     "localidad" VARCHAR(120) NOT NULL,
ADD COLUMN     "logo_url" VARCHAR(500),
ADD COLUMN     "longitud" DECIMAL(9,6) NOT NULL,
ADD COLUMN     "nombre_fantasia" VARCHAR(120) NOT NULL,
ADD COLUMN     "numero" VARCHAR(20) NOT NULL,
ADD COLUMN     "piso" VARCHAR(20),
ADD COLUMN     "portada_url" VARCHAR(500),
ADD COLUMN     "provincia" VARCHAR(120) NOT NULL,
ADD COLUMN     "razon_social" VARCHAR(160) NOT NULL,
ADD COLUMN     "telefono" VARCHAR(30) NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "horario_atencion" (
    "id" UUID NOT NULL,
    "comercio_id" UUID NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "hora_inicio" VARCHAR(5) NOT NULL,
    "hora_fin" VARCHAR(5) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "horario_atencion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "franja_retiro" (
    "id" UUID NOT NULL,
    "comercio_id" UUID NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "hora_inicio" VARCHAR(5) NOT NULL,
    "hora_fin" VARCHAR(5) NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "franja_retiro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "horario_atencion_comercio_id_dia_semana_idx" ON "horario_atencion"("comercio_id", "dia_semana");

-- CreateIndex
CREATE INDEX "franja_retiro_comercio_id_dia_semana_idx" ON "franja_retiro"("comercio_id", "dia_semana");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_nombre_key" ON "categoria"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_slug_key" ON "categoria"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "comercio_cuit_key" ON "comercio"("cuit");

-- CreateIndex
CREATE UNIQUE INDEX "comercio_google_place_id_key" ON "comercio"("google_place_id");

-- CreateIndex
CREATE INDEX "comercio_localidad_idx" ON "comercio"("localidad");

-- CreateIndex
CREATE INDEX "comercio_estado_idx" ON "comercio"("estado");

-- AddForeignKey
ALTER TABLE "horario_atencion" ADD CONSTRAINT "horario_atencion_comercio_id_fkey" FOREIGN KEY ("comercio_id") REFERENCES "comercio"("id_comercio") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "franja_retiro" ADD CONSTRAINT "franja_retiro_comercio_id_fkey" FOREIGN KEY ("comercio_id") REFERENCES "comercio"("id_comercio") ON DELETE CASCADE ON UPDATE CASCADE;
