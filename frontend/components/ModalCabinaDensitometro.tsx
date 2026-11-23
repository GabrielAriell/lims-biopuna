"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  consultarEstadoCabina,
  ajustarCabina,
  capturaLimpiaCabina,
  urlStreamVideo,
  type EstadoCabina,
  type CamaraInfo,
} from "@/lib/api-cabina";

type Props = {
  abierto: boolean;
  onCerrar: () => void;
  onCapturaExitosa: (archivo: File) => void | Promise<void>;
  onUsarCamaraWeb: () => void;
};

const ANCHO_NATIVO = 960;
const ALTO_NATIVO = 540;

export default function ModalCabinaDensitometro({
  abierto,
  onCerrar,
  onCapturaExitosa,
  onUsarCamaraWeb,
}: Props) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoCabina | null>(null);
  const [camaras, setCamaras] = useState<CamaraInfo[]>([]);
  const [camaraActual, setCamaraActual] = useState<number>(0);
  const [streamSrc, setStreamSrc] = useState<string>("");
  const [roi, setRoi] = useState<number[]>([140, 130, 820, 220]);
  const [modoTincion, setModoTincion] = useState<string>("AUTO");

  // Referencias para el arrastre y redimensionado del recuadro verde con el ratón
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<{
    tipo: "mover" | "se" | "sw" | "ne" | "nw" | "e" | "s" | "w" | "n";
    startX: number;
    startY: number;
    startRoi: number[];
  } | null>(null);

  useEffect(() => {
    if (!abierto) {
      setCargando(false);
      setError(null);
      setStreamSrc("");
      return;
    }

    let cancelado = false;
    consultarEstadoCabina().then((est) => {
      if (cancelado || !est) return;
      setEstado(est);
      if (est.camaras_disponibles && est.camaras_disponibles.length > 0) {
        setCamaras(est.camaras_disponibles);
      }
      if (typeof est.camara_actual === "number") {
        setCamaraActual(est.camara_actual);
      }
      if (est.roi_actual && est.roi_actual.length === 4) {
        setRoi(est.roi_actual);
      }
      if (est.modo_tincion) {
        setModoTincion(est.modo_tincion);
      }
    });

    setStreamSrc(urlStreamVideo());

    const manejarTeclado = (e: KeyboardEvent) => {
      if (e.code === "Space" && !cargando) {
        e.preventDefault();
        void ejecutarCaptura();
      } else if (e.key === "Escape") {
        onCerrar();
      }
    };
    window.addEventListener("keydown", manejarTeclado);

    return () => {
      cancelado = true;
      window.removeEventListener("keydown", manejarTeclado);
    };
  }, [abierto]);

  if (!abierto) return null;

  async function ejecutarCaptura() {
    setCargando(true);
    setError(null);
    try {
      const res = await capturaLimpiaCabina();
      if (res.archivo) {
        await onCapturaExitosa(res.archivo);
        onCerrar();
      } else {
        throw new Error("No se obtuvo la imagen capturada.");
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Error al capturar la tira de la cabina.";
      setError(msg);
    } finally {
      setCargando(false);
    }
  }

  async function cambiarCamara(idx: number) {
    setCamaraActual(idx);
    await ajustarCabina({ camara_idx: idx });
    setStreamSrc(urlStreamVideo());
  }

  async function cambiarTincion(modo: string) {
    setModoTincion(modo);
    await ajustarCabina({ modo_tincion: modo });
    // Actualizar estado de iluminación
    consultarEstadoCabina().then((est) => {
      if (est) setEstado(est);
    });
  }

  // --- Manejo del Recuadro Verde Interactivo (Mouse / Touch) ---
  function iniciarArrastre(
    tipo: "mover" | "se" | "sw" | "ne" | "nw" | "e" | "s" | "w" | "n",
    e: ReactPointerEvent
  ) {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    draggingRef.current = {
      tipo,
      startX: e.clientX,
      startY: e.clientY,
      startRoi: [...roi],
    };
  }

  function procesarMovimiento(e: ReactPointerEvent) {
    if (!draggingRef.current || !contenedorRef.current) return;
    const { tipo, startX, startY, startRoi } = draggingRef.current;
    const rect = contenedorRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // Escalar píxeles de pantalla a los 960x540 nativos del video
    const escalaX = ANCHO_NATIVO / rect.width;
    const escalaY = ALTO_NATIVO / rect.height;

    const dx = Math.round((e.clientX - startX) * escalaX);
    const dy = Math.round((e.clientY - startY) * escalaY);

    let [x1, y1, x2, y2] = startRoi;

    if (tipo === "mover") {
      const ancho = x2 - x1;
      const alto = y2 - y1;
      x1 = Math.max(0, Math.min(ANCHO_NATIVO - ancho, x1 + dx));
      y1 = Math.max(0, Math.min(ALTO_NATIVO - alto, y1 + dy));
      x2 = x1 + ancho;
      y2 = y1 + alto;
    } else {
      if (tipo.includes("e")) x2 = Math.min(ANCHO_NATIVO, Math.max(x1 + 40, x2 + dx));
      if (tipo.includes("s")) y2 = Math.min(ALTO_NATIVO, Math.max(y1 + 20, y2 + dy));
      if (tipo.includes("w")) x1 = Math.max(0, Math.min(x2 - 40, x1 + dx));
      if (tipo.includes("n")) y1 = Math.max(0, Math.min(y2 - 20, y1 + dy));
    }

    setRoi([x1, y1, x2, y2]);
  }

  async function finalizarArrastre(e: ReactPointerEvent) {
    if (!draggingRef.current) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignorar
    }
    draggingRef.current = null;
    await ajustarCabina({ roi });
  }

  // Porcentajes para colocar el recuadro verde interactivo
  const pctLeft = (roi[0] / ANCHO_NATIVO) * 100;
  const pctTop = (roi[1] / ALTO_NATIVO) * 100;
  const pctWidth = ((roi[2] - roi[0]) / ANCHO_NATIVO) * 100;
  const pctHeight = ((roi[3] - roi[1]) / ALTO_NATIVO) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-xs select-none">
      <div className="flex flex-col max-h-[96vh] w-full max-w-4xl rounded-2xl border border-gray-700 bg-gray-900 text-white shadow-2xl overflow-hidden">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2.5 bg-gray-950">
          <div className="flex items-center gap-2.5">
            <span className="inline-block h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                Densitómetro Celogel — Cabina en Vivo
              </h3>
              <p className="text-[11px] text-gray-400">
                Arrastrá el recuadro verde para ubicar la tira • Análisis densitométrico en tiempo real
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onCerrar}
              disabled={cargando}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Video en Vivo con Recuadro Verde Interactivo */}
        <div
          ref={contenedorRef}
          onPointerMove={procesarMovimiento}
          onPointerUp={finalizarArrastre}
          className="relative flex-1 bg-black flex items-center justify-center aspect-video w-full overflow-hidden select-none"
        >
          {streamSrc ? (
            <img
              src={streamSrc}
              alt="Transmisión en vivo"
              className="w-full h-full object-contain pointer-events-none select-none"
              onError={() => {
                setError(
                  "No se pudo cargar el video de la cabina. Verificá que la cámara USB esté conectada."
                );
              }}
            />
          ) : (
            <div className="text-gray-400 text-sm">Conectando cámara...</div>
          )}

          {/* RECUADRO VERDE INTERACTIVO (Arrastrable y Redimensionable) */}
          <div
            style={{
              left: `${pctLeft}%`,
              top: `${pctTop}%`,
              width: `${pctWidth}%`,
              height: `${pctHeight}%`,
            }}
            onPointerDown={(e) => iniciarArrastre("mover", e)}
            className="absolute z-20 cursor-move border-2 border-emerald-400 bg-emerald-400/10 transition-colors hover:bg-emerald-400/20 shadow-[0_0_15px_rgba(52,211,153,0.3)]"
          >
            {/* Etiqueta superior */}
            <div className="absolute -top-5 left-0 rounded bg-emerald-700/90 px-1.5 py-0.2 text-[9px] font-semibold text-white pointer-events-none">
              Alineación de Tira
            </div>

            {/* Manija Esquina Inferior Derecha (Redimensionar SE) */}
            <div
              onPointerDown={(e) => iniciarArrastre("se", e)}
              className="absolute -bottom-2 -right-2 h-4 w-4 rounded-sm bg-white border-2 border-emerald-600 cursor-se-resize shadow-md hover:scale-125 transition-transform"
              title="Arrastrar para redimensionar"
            />

            {/* Manija Esquina Inferior Izquierda (SW) */}
            <div
              onPointerDown={(e) => iniciarArrastre("sw", e)}
              className="absolute -bottom-1.5 -left-1.5 h-3 w-3 rounded-sm bg-white border border-emerald-600 cursor-sw-resize hover:scale-125"
            />

            {/* Manija Esquina Superior Derecha (NE) */}
            <div
              onPointerDown={(e) => iniciarArrastre("ne", e)}
              className="absolute -top-1.5 -right-1.5 h-3 w-3 rounded-sm bg-white border border-emerald-600 cursor-ne-resize hover:scale-125"
            />

            {/* Manija Borde Derecho (Estirar ancho) */}
            <div
              onPointerDown={(e) => iniciarArrastre("e", e)}
              className="absolute top-1/2 -right-1.5 -translate-y-1/2 h-5 w-2 rounded-xs bg-emerald-300 border border-emerald-700 cursor-e-resize"
              title="Ajustar ancho"
            />
          </div>

          {cargando && (
            <div className="absolute inset-0 bg-black/75 z-30 flex flex-col items-center justify-center text-white backdrop-blur-xs">
              <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
              <p className="mt-2 text-sm font-medium">Capturando fotograma limpio (10 cuadros promediados)...</p>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-950 border-y border-red-800 px-4 py-1.5 text-xs text-red-200">
            {error}
          </div>
        )}

        {/* Barra de Controles Inferior */}
        <div className="bg-gray-950 border-t border-gray-800 p-3 sm:px-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Selector de Cámara Inteligente */}
            <div className="flex items-center gap-2">
              <span className="text-gray-400 font-medium">Cámara:</span>
              <select
                value={camaraActual}
                onChange={(e) => void cambiarCamara(Number(e.target.value))}
                className="rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                {camaras.length > 0 ? (
                  camaras.map((c) => (
                    <option key={c.idx} value={c.idx}>
                      {c.nombre} {c.idx === camaraActual ? "✓" : ""}
                    </option>
                  ))
                ) : (
                  <option value={0}>USB CAMERA (Cabina)</option>
                )}
              </select>
            </div>

            {/* Selector de Tinción / Contraste con LEDs */}
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 font-medium">Tinción / LEDs:</span>
              <button
                type="button"
                onClick={() => void cambiarTincion("ROJA")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${modoTincion === "ROJA"
                  ? "bg-red-700 text-white shadow-sm ring-1 ring-red-400"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                title="Tira roja (Ponceau S) -> Enciende luz Verde para máximo contraste"
              >
                <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
                Tira Roja
              </button>

              <button
                type="button"
                onClick={() => void cambiarTincion("AZUL")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${modoTincion === "AZUL"
                  ? "bg-blue-700 text-white shadow-sm ring-1 ring-blue-400"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                title="Tira azul (Coomassie) -> Enciende luz Roja para máximo contraste"
              >
                <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
                Tira Azul
              </button>

              <button
                type="button"
                onClick={() => void cambiarTincion("BLANCA")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${modoTincion === "BLANCA"
                  ? "bg-gray-200 text-gray-900 shadow-sm ring-1 ring-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                title="Luz blanca neutral"
              >
                <span className="inline-block h-2 w-2 rounded-full bg-white" />
                Luz Blanca
              </button>
            </div>

            {/* Estado del Arduino / LED actual */}
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              {estado?.arduino_conectado ? (
                <span className="text-emerald-400 font-medium">
                  💡 LEDs en {estado.color_luz_activo}
                </span>
              ) : (
                <span className="text-amber-500/80">
                  (Arduino COM no detectado)
                </span>
              )}
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-800/80">
            <button
              type="button"
              onClick={() => {
                onCerrar();
                onUsarCamaraWeb();
              }}
              className="text-xs text-gray-400 hover:text-white underline underline-offset-2"
            >
              Usar cámara web estándar en su lugar
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onCerrar}
                className="rounded-lg bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-700 hover:text-white"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => void ejecutarCaptura()}
                disabled={cargando}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-emerald-500 active:scale-98 transition-all disabled:opacity-50"
              >
                <span>📸 Capturar Tira</span>
                <kbd className="hidden sm:inline bg-emerald-800 text-[10px] px-1.5 py-0.5 rounded font-mono">
                  ESPACIO
                </kbd>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
