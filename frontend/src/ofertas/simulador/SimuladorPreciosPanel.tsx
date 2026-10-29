import {
  Divider,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
} from '@mantine/core';
import type { SimulacionPrecio } from './simulador.types';

type Props = {
  resultado: SimulacionPrecio | null;
  error: string;
  cargando: boolean;
  precioLista?: string;
};

const formatoMoneda = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
});

function formatearMonto(valor: string): string {
  return formatoMoneda.format(Number(valor));
}

function formatearTasa(tasa: string): string {
  return `${(Number(tasa) * 100).toLocaleString('es-AR', {
    maximumFractionDigits: 2,
  })}%`;
}

function Fila({
  etiqueta,
  valor,
  destacada = false,
}: {
  etiqueta: string;
  valor: string;
  destacada?: boolean;
}) {
  return (
    <Group justify="space-between" gap="md" wrap="nowrap">
      <Text size="sm" c="dimmed">
        {etiqueta}
      </Text>
      <Text size="sm" fw={destacada ? 800 : 700} ta="right">
        {valor}
      </Text>
    </Group>
  );
}

export function SimuladorPreciosPanel({
  resultado,
  error,
  cargando,
  precioLista,
}: Props) {
  const sinDescuento =
    resultado !== null &&
    precioLista !== undefined &&
    precioLista.trim() !== '' &&
    Number(resultado.precioPublico) >= Number(precioLista);

  return (
    <Paper bg="#F3F5F8" p="lg" radius="md" aria-live="polite">
      <Stack gap="sm">
        <Text fw={700} size="md">
          Simulador de precios
        </Text>

        {!cargando && !error && !resultado && (
          <Text size="sm" c="dimmed">
            Ingresá el precio de lista y el precio base neto para ver la
            simulación.
          </Text>
        )}

        {cargando && (
          <Group gap="sm" role="status">
            <Loader size="xs" />
            <Text size="sm" c="dimmed">
              Calculando comisiones y precio final…
            </Text>
          </Group>
        )}

        {!cargando && error && (
          <Text size="sm" c="red" role="alert">
            {error}
          </Text>
        )}

        {!cargando && !error && resultado && (
          <>
            <Fila
              etiqueta={`Comisión MENORCOST (${formatearTasa(resultado.comisionMenorcostTasa)})`}
              valor={formatearMonto(resultado.comisionMenorcostMonto)}
            />
            <Fila
              etiqueta="Precio final al público"
              valor={formatearMonto(resultado.precioPublico)}
              destacada
            />
            <Fila
              etiqueta="Neto que recibís por Mercado Pago"
              valor={formatearMonto(resultado.netoEstimadoComerciante)}
            />
            <Fila
              etiqueta="Descuento visible al cliente"
              valor={
                sinDescuento
                  ? 'Sin descuento'
                  : resultado.ahorroPorcentaje !== undefined
                    ? `${resultado.ahorroPorcentaje}% OFF`
                    : '—'
              }
            />

            <Divider />

            {sinDescuento && (
              <Text size="xs" c="red" fw={600}>
                Con estas comisiones el precio final (
                {formatearMonto(resultado.precioPublico)}) supera el precio de
                lista. Bajá el precio base neto para ofrecer un descuento real.
              </Text>
            )}

            <Text size="xs" c="dimmed">
              {resultado.advertenciaNeto}
            </Text>
          </>
        )}
      </Stack>
    </Paper>
  );
}
