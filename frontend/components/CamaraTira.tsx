"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  abierta: boolean;
  onCerrar: () => void;
  onCapturar: (archivo: File) => void | Promise<void>;
};

type Rect = { x: number; y: number; w: number; h: number }; // porcentaje 0-100

const RECT_INICIAL: Rect = { x: 8, y: 15, w: 84, h: 70 };
const MIN_W = 20;
const MIN_H = 15;

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export default function CamaraTira({ abierta, onCerrar, onCapturar }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const pushStateRef = useRef(false);
  const dragRef = useRef<{
    tipo: "mover" | "nw" | "ne" | "sw" | "se";
    startX: number;
    startY: number;
    rect: Rect;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [lista, setLista] = useState(false);
  const [capturando, setCapturando] = useState(false);
  const [rect, setRect] = useState<Rect>(RECT_INICIAL);

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
      setRect(RECT_INICIAL);
      if (pushStateRef.current) {
        pushStateRef.current = false;
        window.history.back();
      }
      return;
    }

    let cancelado = false;
    setError(null);
    setLista(false);
    setRect(RECT_INICIAL);

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

  const pxToPct = useCallback((dxPx: number, dyPx: number) => {
    const el = contenedorRef.current;
    if (!el) return { dx: 0, dy: 0 };
    const b = el.getBoundingClientRect();
    return {
      dx: b.width ? (dxPx / b.width) * 100 : 0,
      dy: b.height ? (dyPx / b.height) * 100 : 0,
    };
  }, []);

  function iniciarDrag(
    tipo: "mover" | "nw" | "ne" | "sw" | "se",
    e: React.PointerEvent
  ) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { tipo, startX: e.clientX, startY: e.clientY, rect: { ...rect } };
  }

  function moverDrag(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const { dx, dy } = pxToPct(e.clientX - d.startX, e.clientY - d.startY);
    const r = d.rect;
    let nx = r.x;
    let ny = r.y;
    let nw = r.w;
    let nh = r.h;

    if (d.tipo === "mover") {
      nx = clamp(r.x + dx, 0, 100 - r.w);
      ny = clamp(r.y + dy, 0, 100 - r.h);
    } else if (d.tipo === "se") {
      nw = clamp(r.w + dx, MIN_W, 100 - r.x);
      nh = clamp(r.h + dy, MIN_H, 100 - r.y);
    } else if (d.tipo === "sw") {
      nw = clamp(r.w - dx, MIN_W, r.x + r.w);
      nx = r.x + r.w - nw;
      nh = clamp(r.h + dy, MIN_H, 100 - r.y);
    } else if (d.tipo === "ne") {
      nw = clamp(r.w + dx, MIN_W, 100 - r.x);
      nh = clamp(r.h - dy, MIN_H, r.y + r.h);
      ny = r.y + r.h - nh;
    } else if (d.tipo === "nw") {
      nw = clamp(r.w - dx, MIN_W, r.x + r.w);
      nx = r.x + r.w - nw;
      nh = clamp(r.h - dy, MIN_H, r.y + r.h);
      ny = r.y + r.h - nh;
    }

    setRect({ x: nx, y: ny, w: nw, h: nh });
  }

  function finDrag(e: React.PointerEvent) {
    if (dragRef.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      dragRef.current = null;
    }
  }

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

  const manija =
    "absolute z-20 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-emerald-500 shadow touch-none";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/70 px-3 py-2 text-white backdrop-blur sm:px-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold sm:text-base">Cámara para tira</h3>
          <p className="truncate text-[11px] text-white/70 sm:text-xs">
            Arrastrá el recuadro o sus esquinas con los dedos para encuadrar la tira.
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

      <div ref={contenedorRef} className="relative min-h-0 flex-1 touch-none bg-black">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {/* Encuadre ajustable por el usuario */}
        <div className="pointer-events-none absolute inset-0 z-10">
          <div
            className="pointer-events-auto absolute touch-none rounded-md border-2 border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
            style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` }}
            onPointerDown={(e) => iniciarDrag("mover", e)}
            onPointerMove={moverDrag}
            onPointerUp={finDrag}
            onPointerCancel={finDrag}
          >
            <div
              className={manija}
              style={{ left: 0, top: 0 }}
              onPointerDown={(e) => iniciarDrag("nw", e)}
              onPointerMove={moverDrag}
              onPointerUp={finDrag}
              onPointerCancel={finDrag}
            />
            <div
              className={manija}
              style={{ left: "100%", top: 0 }}
              onPointerDown={(e) => iniciarDrag("ne", e)}
              onPointerMove={moverDrag}
              onPointerUp={finDrag}
              onPointerCancel={finDrag}
            />
            <div
              className={manija}
              style={{ left: 0, top: "100%" }}
              onPointerDown={(e) => iniciarDrag("sw", e)}
              onPointerMove={moverDrag}
              onPointerUp={finDrag}
              onPointerCancel={finDrag}
            />
            <div
              className={manija}
              style={{ left: "100%", top: "100%" }}
              onPointerDown={(e) => iniciarDrag("se", e)}
              onPointerMove={moverDrag}
              onPointerUp={finDrag}
              onPointerCancel={finDrag}
            />
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded bg-black/70 px-3 py-1.5 text-center text-xs font-medium text-white sm:text-sm">
          Mové el recuadro o ajustá las esquinas
        </div>

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
              onClick={() => setRect(RECT_INICIAL)}
              className="rounded border border-white/30 px-3 py-2 text-sm font-medium hover:bg-white/10"
            >
              Restablecer
            </button>
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
