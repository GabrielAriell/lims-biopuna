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
  const pushStateRef = useRef(false);

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

  // Cerrar con el botón "atrás" del navegador/celular sin salir de la página.
  useEffect(() => {
    if (!abierta) return;
    window.history.pushState({ camaraTira: true }, "");
    pushStateRef.current = true;

    const onPopState = () => {
      if (!pushStateRef.current) return;
      pushStateRef.current = false;
      onCerrar();
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [abierta, onCerrar]);

  useEffect(() => {
    if (!abierta) {
      detener();
      setError(null);
      setCapturando(false);
      if (pushStateRef.current) {
        pushStateRef.current = false;
        window.history.back();
      }
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
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/70 px-3 py-2 text-white backdrop-blur sm:px-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold sm:text-base">Cámara para tira</h3>
          <p className="truncate text-[11px] text-white/70 sm:text-xs">
            Enfocá la tira y capturá la foto.
          </p>
        </div>
        <button
          type="button"
          onClick={cerrar}
          className="shrink-0 rounded border border-white/30 px-3 py-1.5 text-sm hover:bg-white/10"
        >
          Cerrar
        </button>
      </div>

      <div className="relative min-h-0 flex-1 bg-black">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {!lista && !error && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 text-sm text-white">
            Iniciando cámara...
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-white/10 bg-black/80 px-3 py-3 text-white backdrop-blur sm:px-4">
        {error && (
          <p className="rounded border border-red-400/40 bg-red-500/20 p-2 text-sm text-red-100">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-white/70 sm:text-xs">
            Usá “Cerrar” o el botón atrás del celular para volver sin capturar.
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
              className="rounded bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {capturando ? "Capturando..." : "Capturar foto"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
