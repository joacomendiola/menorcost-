-- CreateTable
CREATE TABLE "canasta" (
    "id_canasta" UUID NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "comercio_id" UUID NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canasta_pkey" PRIMARY KEY ("id_canasta")
);

-- CreateTable
CREATE TABLE "canasta_item" (
    "id_canasta_item" UUID NOT NULL,
    "canasta_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canasta_item_pkey" PRIMARY KEY ("id_canasta_item")
);

-- CreateIndex
CREATE INDEX "canasta_usuario_id_idx" ON "canasta"("usuario_id");

-- CreateIndex
CREATE INDEX "canasta_comercio_id_idx" ON "canasta"("comercio_id");

-- CreateIndex
CREATE UNIQUE INDEX "canasta_usuario_id_comercio_id_key" ON "canasta"("usuario_id", "comercio_id");

-- CreateIndex
CREATE INDEX "canasta_item_producto_id_idx" ON "canasta_item"("producto_id");

-- CreateIndex
CREATE UNIQUE INDEX "canasta_item_canasta_id_producto_id_key" ON "canasta_item"("canasta_id", "producto_id");

-- AddForeignKey
ALTER TABLE "canasta" ADD CONSTRAINT "canasta_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canasta" ADD CONSTRAINT "canasta_comercio_id_fkey" FOREIGN KEY ("comercio_id") REFERENCES "comercio"("id_comercio") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canasta_item" ADD CONSTRAINT "canasta_item_canasta_id_fkey" FOREIGN KEY ("canasta_id") REFERENCES "canasta"("id_canasta") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canasta_item" ADD CONSTRAINT "canasta_item_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id_producto") ON DELETE RESTRICT ON UPDATE CASCADE;
