-- CreateEnum
CREATE TYPE "TipoProducto" AS ENUM ('INDIVIDUAL', 'COMBO');

-- CreateEnum
CREATE TYPE "EstadoProducto" AS ENUM ('ACTIVO', 'PAUSADO', 'VENCIDO_ELIMINADO', 'ELIMINADO');

-- CreateTable
CREATE TABLE "producto" (
    "id_producto" UUID NOT NULL,
    "id_comercio" UUID NOT NULL,
    "id_categoria" UUID NOT NULL,
    "tipo" "TipoProducto" NOT NULL DEFAULT 'INDIVIDUAL',
    "titulo" VARCHAR(120) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fecha_vencimiento" DATE NOT NULL,
    "stock" INTEGER NOT NULL,
    "precio_lista" DECIMAL(10,2) NOT NULL,
    "precio_menorcost" DECIMAL(10,2) NOT NULL,
    "imagen" VARCHAR(500) NOT NULL,
    "estado" "EstadoProducto" NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT "producto_pkey" PRIMARY KEY ("id_producto")
);

-- CreateTable
CREATE TABLE "comercio" (
    "id_comercio" UUID NOT NULL,

    CONSTRAINT "comercio_pkey" PRIMARY KEY ("id_comercio")
);

-- CreateTable
CREATE TABLE "categoria" (
    "id_categoria" UUID NOT NULL,

    CONSTRAINT "categoria_pkey" PRIMARY KEY ("id_categoria")
);

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "producto_id_comercio_fkey" FOREIGN KEY ("id_comercio") REFERENCES "comercio"("id_comercio") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "producto_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "categoria"("id_categoria") ON DELETE RESTRICT ON UPDATE CASCADE;
