-- Un pedido solo puede tener un pago aprobado. Los intentos rechazados
-- quedan registrados y se permite crear un nuevo pago sin destruir la orden.
CREATE UNIQUE INDEX "pago_unico_aprobado"
ON "pagos"("id_pedido")
WHERE "estado" = 'PAGADO';
