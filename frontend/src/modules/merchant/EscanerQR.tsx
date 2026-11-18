import { useEffect, useRef, useState } from 'react';
import { Button, Text } from '@mantine/core';

type CodigoDetectado = { rawValue: string };

type DetectorCtor = new (opciones?: { formats?: string[] }) => {
  detect: (fuente: HTMLVideoElement) => Promise<CodigoDetectado[]>;
};

/**
 * `BarcodeDetector` es una API del navegador que todavía no está en todos
 * (Firefox y Safari no la exponen). Si no está, se avisa y se usa el ingreso
 * manual del código: nunca se rompe el flujo de mostrador.
 */
function obtenerDetector(): DetectorCtor | null {
  if (typeof window === 'undefined') return null;

  const ctor = (window as unknown as { BarcodeDetector?: DetectorCtor })
    .BarcodeDetector;

  return ctor ?? null;
}

export function EscanerQR({
  onCodigo,
}: {
  onCodigo: (codigo: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onCodigoRef = useRef(onCodigo);
  const [activo, setActivo] = useState(false);
  const [error, setError] = useState('');
  const [soportado] = useState(() => obtenerDetector() !== null);

  useEffect(() => {
    onCodigoRef.current = onCodigo;
  }, [onCodigo]);

  function detener() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setActivo(false);
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!activo) return;

    const video = videoRef.current;
    const stream = streamRef.current;
    const Detector = obtenerDetector();

    if (!video || !stream || !Detector) return;

    video.srcObject = stream;
    void video.play().catch(() => {
      setError('No pudimos iniciar la vista de la cámara.');
    });

    const detector = new Detector({ formats: ['qr_code'] });
    let seguir = true;

    void (async () => {
      while (seguir) {
        try {
          const codigos = await detector.detect(video);
          const valor = codigos[0]?.rawValue?.trim();

          if (valor) {
            seguir = false;
            detener();
            onCodigoRef.current(valor);
            return;
          }
        } catch {
          // Frame ilegible: se ignora y se prueba con el siguiente.
        }

        await new Promise((resolver) => setTimeout(resolver, 300));
      }
    })();

    return () => {
      seguir = false;
    };
  }, [activo]);

  async function iniciar() {
    if (!soportado) {
      setError(
        'Este navegador no soporta el escaneo de QR. Ingresá el código manualmente.',
      );
      return;
    }

    setError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setActivo(true);
    } catch {
      detener();
      setError(
        'No pudimos abrir la cámara. Revisá los permisos o ingresá el código a mano.',
      );
    }
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <Button
        type="button"
        variant="default"
        onClick={() => (activo ? detener() : void iniciar())}
      >
        {activo ? 'Detener cámara' : 'Escanear QR'}
      </Button>

      {!soportado && (
        <Text size="xs" c="dimmed">
          Tu navegador no soporta el escaneo nativo de QR: usá el código
          alfanumérico del ticket.
        </Text>
      )}

      {error && (
        <Text size="sm" c="red" role="alert">
          {error}
        </Text>
      )}

      {activo && (
        <video
          ref={videoRef}
          muted
          playsInline
          style={{
            width: '100%',
            maxWidth: 320,
            borderRadius: 12,
            background: '#000',
          }}
        />
      )}
    </div>
  );
}
