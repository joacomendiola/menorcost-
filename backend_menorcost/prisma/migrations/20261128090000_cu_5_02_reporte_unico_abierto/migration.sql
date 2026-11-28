CREATE UNIQUE INDEX "reporte_id_pedido_id_emisor_abierto_idx"
  ON "reporte" ("id_pedido", "id_emisor")
  WHERE "estado_reporte" IN ('PENDIENTE_REVISION', 'BAJO_INVESTIGACION');
