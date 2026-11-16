import { Button, Loader, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError } from '../api';
import { mercadoPagoApi } from './api';

interface Props {
  token: string;
  vinculado: boolean;
  habilitado: boolean;
  onCambio: () => void;
}

type Aviso = { color: 'green' | 'red' | 'yellow'; texto: string };

const AVISO_CANCELADO =
  'Para publicar ofertas y recibir pedidos en Menorcost es obligatorio vincular una cuenta de Mercado Pago. Tus publicaciones van a quedar ocultas hasta completar este paso.';

const AVISOS: Record<string, Aviso> = {
  ok: {
    color: 'green',
    texto:
      '¡Listo! Tu cuenta de Mercado Pago quedó vinculada. Ya podés recibir pagos por Mercado Pago.',
  },
  cancelado: { color: 'yellow', texto: AVISO_CANCELADO },
  state_invalido: {
    color: 'red',
    texto: 'La vinculación venció o ya fue usada. Volvé a intentarlo.',
  },
  codigo_invalido: {
    color: 'red',
    texto:
      'El código de autorización venció o ya fue usado. Volvé a intentar la vinculación.',
  },
  cuenta_mp_en_uso: {
    color: 'red',
    texto:
      'Esa cuenta de Mercado Pago ya está vinculada a otro comercio. Usá otra cuenta.',
  },
  ya_vinculado: {
    color: 'yellow',
    texto:
      'Tu comercio ya tiene una cuenta vinculada. Desvinculala primero si querés cambiarla.',
  },
  comercio_no_habilitado: {
    color: 'red',
    texto:
      'Tu comercio todavía no está habilitado. Una vez aprobado vas a poder vincular Mercado Pago.',
  },
  usuario_no_habilitado: {
    color: 'red',
    texto: 'Tu cuenta todavía no está habilitada para vincular Mercado Pago.',
  },
  sin_comercio: {
    color: 'red',
    texto: 'Todavía no registraste tu comercio.',
  },
  mp_no_disponible: {
    color: 'red',
    texto:
      'Mercado Pago no está respondiendo. Esperá unos minutos y volvé a intentar.',
  },
  error_interno: {
    color: 'red',
    texto: 'No pudimos completar la vinculación con Mercado Pago.',
  },
};

function resolverAviso(
  resultado: string | null,
  motivo: string | null,
): Aviso | null {
  if (!resultado) return null;
  const clave = resultado === 'ok' ? 'ok' : (motivo ?? resultado);
  return AVISOS[clave] ?? AVISOS.error_interno;
}

export function MercadoPagoBoton({
  token,
  vinculado,
  habilitado,
  onCambio,
}: Props) {
  const [params, setParams] = useSearchParams();
  const resultado = params.get('mp');
  const motivo = params.get('motivo');
  const [conectando, setConectando] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const cambioRef = useRef(onCambio);
  const avisoMostrado = useRef<string | null>(null);

  useEffect(() => {
    cambioRef.current = onCambio;
  }, [onCambio]);

  useEffect(() => {
    if (!resultado) {
      avisoMostrado.current = null;
      return;
    }

    const clave = `${resultado}|${motivo ?? ''}`;

    // StrictMode vuelve a ejecutar los efectos en desarrollo: mostramos un solo aviso.
    if (avisoMostrado.current === clave) return;
    avisoMostrado.current = clave;

    const mensaje = resolverAviso(resultado, motivo) ?? AVISOS.error_interno;
    notifications.show({
      color: mensaje.color,
      title: 'Mercado Pago',
      message: mensaje.texto,
    });

    if (resultado === 'ok') {
      cambioRef.current();
    }

    setParams({}, { replace: true });
  }, [resultado, motivo, setParams]);

  async function vincular() {
    setConectando(true);

    try {
      const { url } = await mercadoPagoApi.urlAutorizacion(token);
      window.location.assign(url);
    } catch (error) {
      const mensaje =
        error instanceof ApiError
          ? error.message
          : 'No pudimos iniciar la vinculación con Mercado Pago.';
      notifications.show({
        color: 'red',
        title: 'Mercado Pago',
        message: mensaje,
      });
      setConectando(false);
    }
  }

  async function desvincular() {
    setDesconectando(true);

    try {
      await mercadoPagoApi.desconectar(token);
      notifications.show({
        color: 'green',
        title: 'Mercado Pago',
        message: 'Desvinculaste tu cuenta de Mercado Pago.',
      });
      onCambio();
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Mercado Pago',
        message:
          error instanceof ApiError
            ? error.message
            : 'No pudimos desvincular la cuenta.',
      });
    } finally {
      setDesconectando(false);
    }
  }

  return (
    <div className="comercio-mp">
      <Stack gap={8} align="flex-end">
        <Button
          onClick={() => void (vinculado ? desvincular() : vincular())}
          loading={conectando || desconectando}
          disabled={!habilitado}
          leftSection={conectando ? <Loader size="xs" /> : undefined}
        >
          {vinculado ? 'Desvincular Mercado Pago' : 'Vincular Mercado Pago'}
        </Button>

        {!habilitado && (
          <Text size="xs" c="dimmed" ta="right">
            Disponible cuando tu comercio esté habilitado.
          </Text>
        )}

        {habilitado && !vinculado && (
          <Text size="xs" c="dimmed" ta="right">
            Obligatorio para publicar ofertas y cobrar.
          </Text>
        )}
      </Stack>
    </div>
  );
}
