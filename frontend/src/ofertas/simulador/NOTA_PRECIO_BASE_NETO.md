# Contrato de precios entre el simulador y las ofertas

## Situación actual

`Producto` persiste los tres precios que produce el simulador:

```prisma
precioLista      Decimal
precioBaseNeto   Decimal
precioPublico    Decimal
```

Además guarda las tasas aplicadas (`comisionMenorcostTasaAplicada` y
`tasaMpEstimadaAplicada`) como snapshot del cálculo.

## Contrato

- **Alta de oferta:** el simulador recibe `precioBaseNeto` y `precioLista`,
  calcula el precio público y el formulario envía `precioBaseNeto` a
  `POST /offers`. El backend vuelve a calcular las comisiones y el
  `precioPublico`; no confía en montos precalculados por el frontend.
- **Edición de oferta:** el formulario precarga `precioLista` y
  `precioBaseNeto` desde la oferta, y muestra `precioPublico` como precio final
  al público. El backend recalcula el público al guardar.
- **Visualización:** el panel de ofertas usa `precioPublico` como precio
  promocional y `precioLista` como precio original.
