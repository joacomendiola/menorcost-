-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'PAGADO', 'RECHAZADO', 'REEMBOLSADO');

-- CreateEnum
CREATE TYPE "TipoSplit" AS ENUM ('COMERCIO', 'MARKETPLACE');

-- CreateEnum
CREATE TYPE "EstadoCredencialMp" AS ENUM ('ACTIVA', 'REVOCADA', 'EXPIRADA');

-- AlterTable
ALTER TABLE "pedido" ADD COLUMN     "comision_menorcost_tasa" DECIMAL(6,4) NOT NULL,
ADD COLUMN     "fecha_expiracion_pago" TIMESTAMP(3),
ADD COLUMN     "id_config_comision" UUID NOT NULL,
ADD COLUMN     "nro_pedido" VARCHAR(30) NOT NULL,
ADD COLUMN     "tasa_mp_estimada" DECIMAL(6,4) NOT NULL,
ALTER COLUMN "estado" SET DEFAULT 'PENDIENTE_PAGO';

-- AlterTable
ALTER TABLE "pedido_item" ADD COLUMN     "comision_menorcost_monto" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "fecha_vencimiento_historica" DATE NOT NULL,
ADD COLUMN     "nombre_historico" VARCHAR(120) NOT NULL,
ADD COLUMN     "nro_linea" INTEGER NOT NULL,
ADD COLUMN     "precio_base_neto_aplicado" DECIMAL(10,2) NOT NULL;

-- CreateTable
CREATE TABLE "config_comision" (
    "id_comision" UUID NOT NULL,
    "comision_menorcost" DECIMAL(6,4) NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_comision_pkey" PRIMARY KEY ("id_comision")
);

-- CreateTable
CREATE TABLE "credenciales_mp" (
    "id_credencial" UUID NOT NULL,
    "mp_user_id" VARCHAR(64) NOT NULL,
    "id_comercio" UUID NOT NULL,
    "email" VARCHAR(255),
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "fecha_token_expiration" TIMESTAMP(3) NOT NULL,
    "fecha_vinculacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoCredencialMp" NOT NULL DEFAULT 'ACTIVA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credenciales_mp_pkey" PRIMARY KEY ("id_credencial")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id_pago" UUID NOT NULL,
    "id_pedido" UUID NOT NULL,
    "mp_payment_id" VARCHAR(64),
    "nro_comprobante" VARCHAR(64),
    "monto_transaccion" DECIMAL(10,2) NOT NULL,
    "comision_mp" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payment_date" TIMESTAMP(3),
    "estado" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id_pago")
);

-- CreateTable
CREATE TABLE "splits_pagos" (
    "id_split" UUID NOT NULL,
    "id_pago" UUID NOT NULL,
    "recipient_type" "TipoSplit" NOT NULL,
    "destinatario_id" UUID,
    "monto" DECIMAL(10,2) NOT NULL,
    "moneda" VARCHAR(3) NOT NULL DEFAULT 'ARS',
    "fecha_hora_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "splits_pagos_pkey" PRIMARY KEY ("id_split")
);

-- CreateIndex
CREATE INDEX "config_comision_activa_idx" ON "config_comision"("activa");

-- CreateIndex
CREATE UNIQUE INDEX "config_comision_activa_unica" ON "config_comision"("activa") WHERE "activa" = true;

-- CreateIndex
CREATE UNIQUE INDEX "credenciales_mp_mp_user_id_key" ON "credenciales_mp"("mp_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "credenciales_mp_id_comercio_key" ON "credenciales_mp"("id_comercio");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_mp_payment_id_key" ON "pagos"("mp_payment_id");

-- CreateIndex
CREATE INDEX "pagos_id_pedido_idx" ON "pagos"("id_pedido");

-- CreateIndex
CREATE INDEX "pagos_estado_idx" ON "pagos"("estado");

-- CreateIndex
CREATE INDEX "splits_pagos_id_pago_idx" ON "splits_pagos"("id_pago");

-- CreateIndex
CREATE UNIQUE INDEX "splits_pagos_id_pago_recipient_type_key" ON "splits_pagos"("id_pago", "recipient_type");

-- CreateIndex
CREATE UNIQUE INDEX "pedido_nro_pedido_key" ON "pedido"("nro_pedido");

-- CreateIndex
CREATE INDEX "pedido_usuario_id_idx" ON "pedido"("usuario_id");

-- CreateIndex
CREATE INDEX "pedido_id_comercio_idx" ON "pedido"("id_comercio");

-- CreateIndex
CREATE INDEX "pedido_estado_idx" ON "pedido"("estado");

-- CreateIndex
CREATE INDEX "pedido_item_id_producto_idx" ON "pedido_item"("id_producto");

-- CreateIndex
CREATE UNIQUE INDEX "pedido_item_id_pedido_nro_linea_key" ON "pedido_item"("id_pedido", "nro_linea");

-- AddForeignKey
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_id_config_comision_fkey" FOREIGN KEY ("id_config_comision") REFERENCES "config_comision"("id_comision") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credenciales_mp" ADD CONSTRAINT "credenciales_mp_id_comercio_fkey" FOREIGN KEY ("id_comercio") REFERENCES "comercio"("id_comercio") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_id_pedido_fkey" FOREIGN KEY ("id_pedido") REFERENCES "pedido"("id_pedido") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "splits_pagos" ADD CONSTRAINT "splits_pagos_id_pago_fkey" FOREIGN KEY ("id_pago") REFERENCES "pagos"("id_pago") ON DELETE CASCADE ON UPDATE CASCADE;
