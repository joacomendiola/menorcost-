# Nota: `Producto` no persiste `precioBaseNeto`

## Situación actual

El precio base neto sí se persiste como **snapshot histórico del pedido**:

```prisma
model PedidoItem {
  precioBaseNetoAplicado Decimal @map("precio_base_neto_aplicado") @db.Decimal(10, 2)
}
```

Pero la oferta (`Producto`) solo guarda:

```prisma
precioLista      Decimal
precioMenorcost  Decimal
```

No existe `Producto.precioBaseNeto`.

## Impacto

- **Alta de oferta:** funciona. El simulador recibe el base neto, calcula el precio público y el formulario envía `precioMenorcost = precioPublico` a `POST /offers`.
- **Edición de oferta:** no se puede precargar el precio base neto porque no está asociado al producto. Tampoco conviene derivarlo desde `precioMenorcost`, porque el cálculo inverso con redondeos hacia arriba puede no devolver el valor original.
- **Este sprint:** el simulador se integra únicamente en “Nueva oferta”. La edición queda fuera de alcance.

## Si más adelante se necesita editar con simulador

Agregar `precioBaseNeto` a `Producto` y actualizar:

- `CreateOfferDto` y `UpdateOfferDto`.
- El adaptador Prisma de ofertas.
- La respuesta de `OfferDetails`.
- El formulario de edición para precargar ese valor.

Ese cambio corresponde coordinarlo con D3, dueño de la entidad `Producto`.
