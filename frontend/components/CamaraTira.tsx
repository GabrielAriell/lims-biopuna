"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  abierta: boolean;
  onCerrar: () => void;
  onCapturar: (archivo: File) => void | Promise<void>;
};

// Guías de referencia de franjas (proporciones aproximadas dentro de la tira).
// Sirven como ayuda visual para encuadrar antes de capturar.
const FRANJAS_GUIA = [0.22, 0.38, 0.52, 0.68, 0.82];

export default function CamaraTira({ abierta, onCerrar, onCapturar }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pushStateRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [lista, setLista] = useState(false);
  const [capturando, setCapturando] = useState(false);
  const [orientacion, setOrientacion] = useState<"horizontal" | "vertical">(
    "horizontal"
  );
  const [mostrarFranjas, setMostrarFranjas] = useState(true);
  const [tamanoGuia, setTamanoGuia] = useState(92); // % del área de video

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
      // Si se cerró por UI (no por "atrás"), revertir el estado de historial.
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

  const guiaAncho = orientacion === "horizontal" ? tamanoGuia : Math.max(35, tamanoGuia - 30);
  const guiaAlto = orientacion === "horizontal" ? Math.max(30, 100 - tamanoGuia + 20) : tamanoGuia;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Barra superior */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/70 px-3 py-2 text-white backdrop-blur sm:px-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold sm:text-base">Cámara para tira</h3>
          <p className="truncate text-[11px] text-white/70 sm:text-xs">
            Alineá la tira en el recuadro. Las franjas son guías visuales de referencia.
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

      {/* Vista de cámara (grande, ocupa el espacio disponible) */}
      <div className="relative min-h-0 flex-1 bg-black">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {/* Guías de encuadre y franjas */}
        <div className="pointer-events-none absolute inset-0 z-10">
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
            style={{ width: `${guiaAncho}%`, height: `${guiaAlto}%` }}
          >
            {/* Ejes centrales */}
            <div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-emerald-300/50" />
            <div className="absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2 bg-emerald-300/40" />

            {/* Franjas guía (delimitación visual de zonas) */}
            {mostrarFranjas &&
              FRANJAS_GUIA.map((p) =>
                orientacion === "horizontal" ? (
                  <div
                    key={p}
                    className="absolute top-0 h-full w-[2px] bg-cyan-300/70"
                    style={{ left: `${p * 100}%` }}
                  />
                ) : (
                  <div
                    key={p}
                    className="absolute left-0 h-[2px] w-full bg-cyan-300/70"
                    style={{ top: `${p * 100}%` }}
                  />
                )
              )}

            {/* Marcas de esquinas */}
            <div className="absolute -left-[2px] -top-[2px] h-7 w-7 border-l-4 border-t-4 border-emerald-300" />
            <div className="absolute -right-[2px] -top-[2px] h-7 w-7 border-r-4 border-t-4 border-emerald-300" />
            <div className="absolute -bottom-[2px] -left-[2px] h-7 w-7 border-b-4 border-l-4 border-emerald-300" />
            <div className="absolute -bottom-[2px] -right-[2px] h-7 w-7 border-b-4 border-r-4 border-emerald-300" />
          </div>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-black/70 px-3 py-1.5 text-center text-xs font-medium text-white sm:text-sm">
            Encadrá la tira en el recuadro verde · Franjas celestes: guía de zonas
          </div>
        </div>

        {!lista && !error && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 text-sm text-white">
            Iniciando cámara...
          </div>
        )}
      </div>

      {/* Controles */}
      <div className="space-y-3 border-t border-white/10 bg-black/80 px-3 py-3 text-white backdrop-blur sm:px-4">
        {error && (
          <p className="rounded border border-red-400/40 bg-red-500/20 p-2 text-sm text-red-100">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm">
          <label className="flex items-center gap-2">
            <span className="text-white/80">Tira</span>
            <select
              value={orientacion}
              onChange={(e) => setOrientacion(e.target.value as "horizontal" | "vertical")}
              className="rounded border border-white/30 bg-white/10 px-2 py-1 text-white"
            >
              <option value="horizontal" className="text-black">Horizontal</option>
              <option value="vertical" className="text-black">Vertical</option>
            </select>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mostrarFranjas}
              onChange={(e) => setMostrarFranjas(e.target.checked)}
            />
            <span>Mostrar franjas guía</span>
          </label>

          <label className="flex min-w-[180px] flex-1 items-center gap-2">
            <span className="whitespace-nowrap text-white/80">Tamaño guía</span>
            <input
              type="range"
              min={60}
              max={98}
              value={tamanoGuia}
              onChange={(e) => setTamanoGuia(Number(e.target.value))}
              className="w-full"
            />
          </label>
        </div>

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
