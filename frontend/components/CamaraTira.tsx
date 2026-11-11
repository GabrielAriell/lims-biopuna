"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  abierta: boolean;
  onCerrar: () => void;
  onCapturar: (archivo: File) => void | Promise<void>;
};

export default function CamaraTira({ abierta, onCerrar, onCapturar }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lista, setLista] = useState(false);
  const [capturando, setCapturando] = useState(false);

  const detener = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setLista(false);
  }, []);

  useEffect(() => {
    if (!abierta) {
      detener();
      setError(null);
      return;
    }

    let cancelado = false;
    setError(null);
    setLista(false);

    async function iniciar() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Este navegador no permite usar la cámara integrada.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
          if (!cancelado) setLista(true);
        }
      } catch {
        if (!cancelado) {
          setError(
            "No se pudo acceder a la cámara. Verificá permisos del navegador/dispositivo."
          );
        }
      }
    }

    void iniciar();
    return () => {
      cancelado = true;
      detener();
    };
  }, [abierta, detener]);

  async function capturar() {
    const video = videoRef.current;
    if (!video || !lista || video.videoWidth === 0 || video.videoHeight === 0) return;
    setCapturando(true);
    try {
      const lienzo = document.createElement("canvas");
      lienzo.width = video.videoWidth;
      lienzo.height = video.videoHeight;
      const ctx = lienzo.getContext("2d");
      if (!ctx) throw new Error("No se pudo capturar la imagen");
      ctx.drawImage(video, 0, 0, lienzo.width, lienzo.height);
      const blob = await new Promise<Blob | null>((resolver) =>
        lienzo.toBlob(resolver, "image/jpeg", 0.92)
      );
      if (!blob) throw new Error("No se pudo generar la foto");
      const archivo = new File([blob], `captura_tira_${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      detener();
      await onCapturar(archivo);
      onCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo capturar la foto");
    } finally {
      setCapturando(false);
    }
  }

  function cerrar() {
    detener();
    onCerrar();
  }

  if (!abierta) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6">
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-gray-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white">
          <div>
            <h3 className="text-base font-semibold">Cámara para tira</h3>
            <p className="text-xs text-white/70">
              Alineá la tira dentro del recuadro guía y evitá sombras/reflejos.
            </p>
          </div>
          <button
            type="button"
            onClick={cerrar}
            className="rounded border border-white/30 px-3 py-1 text-sm hover:bg-white/10"
          >
            Cerrar
          </button>
        </div>

        <div className="relative aspect-[4/3] w-full bg-black sm:aspect-video">
          <video
            ref={videoRef}
            className="h-full w-full object-contain"
            playsInline
            muted
            autoPlay
          />

          {/* Guías de encuadre en vivo */}
          <div className="pointer-events-none absolute inset-0">
            {/* oscurecer bordes para resaltar área central */}
            <div className="absolute inset-0 bg-black/20" />
            <div className="absolute left-1/2 top-1/2 h-[70%] w-[82%] -translate-x-1/2 -translate-y-1/2 rounded-md border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
            {/* línea central */}
            <div className="absolute left-1/2 top-[15%] h-[70%] w-px -translate-x-1/2 bg-emerald-300/60" />
            <div className="absolute left-[9%] top-1/2 h-px w-[82%] -translate-y-1/2 bg-emerald-300/40" />
            {/* marcas de esquinas */}
            <div className="absolute left-[9%] top-[15%] h-5 w-5 border-l-4 border-t-4 border-emerald-300" />
            <div className="absolute right-[9%] top-[15%] h-5 w-5 border-r-4 border-t-4 border-emerald-300" />
            <div className="absolute bottom-[15%] left-[9%] h-5 w-5 border-b-4 border-l-4 border-emerald-300" />
            <div className="absolute bottom-[15%] right-[9%] h-5 w-5 border-b-4 border-r-4 border-emerald-300" />
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-black/60 px-3 py-1 text-xs text-white">
              Encadrá la tira dentro del recuadro
            </div>
          </div>

          {!lista && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white">
              Iniciando cámara...
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-white/10 px-4 py-4 text-white">
          {error && (
            <p className="rounded border border-red-400/40 bg-red-500/20 p-2 text-sm text-red-100">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-white/70">
              La imagen se captura en el navegador y se usa para el análisis (no se guarda sola).
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cerrar}
                className="rounded border border-white/30 px-4 py-2 text-sm font-medium hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void capturar()}
                disabled={!lista || !!error || capturando}
                className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {capturando ? "Capturando..." : "Capturar foto"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
