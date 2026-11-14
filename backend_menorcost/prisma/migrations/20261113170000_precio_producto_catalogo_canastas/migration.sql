-- Keep the legacy consumer price while aligning Producto with the current Prisma model.
ALTER TABLE "producto"
RENAME COLUMN "precio_menorcost" TO "precio_publico";

ALTER TABLE "producto"
ADD COLUMN "precio_base_neto" DECIMAL(10,2),
ADD COLUMN "comision_menorcost_tasa_aplicada" DECIMAL(6,4),
ADD COLUMN "tasa_mp_estimada_aplicada" DECIMAL(6,4);

-- Older products stored only their public sale price. Preserve that exact public
-- price and estimate the missing net base using the active commission and the
-- same estimated Mercado Pago fee used by the pricing simulator.
UPDATE "producto" AS producto
SET
  "comision_menorcost_tasa_aplicada" = COALESCE(
    (
      SELECT comision."comision_menorcost"
      FROM "config_comision" AS comision
      WHERE comision."activa" = true
      ORDER BY comision."created_at" DESC
      LIMIT 1
    ),
    0.1000
  ),
  "tasa_mp_estimada_aplicada" = 0.0650,
  "precio_base_neto" = GREATEST(
    0.01,
    ROUND(
      producto."precio_publico" * (1 - 0.0650) /
      (1 + COALESCE(
        (
          SELECT comision."comision_menorcost"
          FROM "config_comision" AS comision
          WHERE comision."activa" = true
          ORDER BY comision."created_at" DESC
          LIMIT 1
        ),
        0.1000
      )),
      2
    )
  );

ALTER TABLE "producto"
ALTER COLUMN "precio_base_neto" SET NOT NULL,
ALTER COLUMN "comision_menorcost_tasa_aplicada" SET NOT NULL,
ALTER COLUMN "tasa_mp_estimada_aplicada" SET NOT NULL;
