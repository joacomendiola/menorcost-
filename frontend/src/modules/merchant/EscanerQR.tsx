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
  const montadoRef = useRef(true);
  const iniciandoRef = useRef(false);
  const onCodigoRef = useRef(onCodigo);
  const [activo, setActivo] = useState(false);
  const [iniciando, setIniciando] = useState(false);
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
    montadoRef.current = true;

    return () => {
      montadoRef.current = false;
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

    // Evita abrir dos cámaras con doble clic o mientras se pide el permiso.
    if (iniciandoRef.current || streamRef.current) return;

    setError('');
    iniciandoRef.current = true;
    setIniciando(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      // El componente se desmontó mientras el navegador pedía permiso:
      // hay que apagar la cámara antes de salir.
      if (!montadoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      // El guard de arriba garantiza que no hay un stream previo.
      streamRef.current = stream;
      setActivo(true);
    } catch {
      detener();
      if (montadoRef.current) {
        setError(
          'No pudimos abrir la cámara. Revisá los permisos o ingresá el código a mano.',
        );
      }
    } finally {
      iniciandoRef.current = false;
      if (montadoRef.current) setIniciando(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <Button
        type="button"
        variant="default"
        loading={iniciando}
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
            background: 'var(--video-bg)',
          }}
        />
      )}
    </div>
  );
}
