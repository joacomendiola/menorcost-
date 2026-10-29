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

export function SimuladorPreciosPanel({ resultado, error, cargando }: Props) {
  return (
    <Paper bg="#F3F5F8" p="md" radius="md" aria-live="polite">
      <Stack gap="sm">
        <Text fw={800}>Simulador de precios</Text>

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
                resultado.ahorroPorcentaje !== undefined
                  ? `${resultado.ahorroPorcentaje}% OFF`
                  : '—'
              }
            />

            <Divider />

            <Text size="xs" c="dimmed">
              {resultado.advertenciaNeto}
            </Text>
          </>
        )}
      </Stack>
    </Paper>
  );
}
