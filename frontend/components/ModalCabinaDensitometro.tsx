"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  consultarEstadoCabina,
  ajustarCabina,
  capturaLimpiaCabina,
  debeIntentarBridgeLocal,
  urlStreamVideo,
  type EstadoCabina,
  type CamaraInfo,
} from "@/lib/api-cabina";
import {
  ControladorArduinoWeb,
  soportaWebSerial,
} from "@/lib/arduino-cabina";
import {
  ALTO_CAPTURA,
  ALTO_VENTANA,
  ANCHO_CAPTURA,
  ANCHO_VENTANA,
  acumularUndistortBilineal,
  aplicarUndistortRapido,
  construirMapaUndistort,
  elegirCamaraCabina,
  guardarCamaraPreferida,
  leerCamaraPreferida,
  listarCamarasWeb,
  type CamaraWebInfo,
  type MapaUndistort,
} from "@/lib/camara-cabina";
import {
  dibujarGraficaYAreasCanvas,
  procesarRoiEnVivo,
} from "@/lib/densitometria-cabina";

type Props = {
  abierto: boolean;
  onCerrar: () => void;
  onCapturaExitosa: (archivo: File) => void | Promise<void>;
  onUsarCamaraWeb: () => void;
};

type ModoConexion = "navegador" | "servidor";

const ANCHO_NATIVO = ANCHO_VENTANA;
const ALTO_NATIVO = ALTO_VENTANA;
const ROI_INICIAL: [number, number, number, number] = [140, 130, 820, 220];

function esperarCuadroVideo(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    const vConCallback = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
    };
    if (typeof vConCallback.requestVideoFrameCallback === "function") {
      vConCallback.requestVideoFrameCallback(() => resolve());
    } else {
      requestAnimationFrame(() => resolve());
    }
  });
}

function describirErrorCamara(err: unknown): string {
  const nombre = err instanceof DOMException ? err.name : "";
  if (nombre === "NotAllowedError" || nombre === "PermissionDeniedError") {
    return "El navegador no tiene permiso para usar la cámara. Habilitá el acceso en la barra de direcciones.";
  }
  if (nombre === "NotReadableError" || nombre === "TrackStartError") {
    return "La cámara USB está ocupada por otra app (ej. Cámara de Windows). Cerrala e intentá de nuevo.";
  }
  if (nombre === "NotFoundError" || nombre === "DevicesNotFoundError") {
    return "No se detectó ninguna cámara USB conectada en este equipo.";
  }
  return "No se pudo iniciar la cámara USB en el navegador. Verificá que esté conectada.";
}

function dibujarHudCanvas(
  ctx: CanvasRenderingContext2D,
  modoTincion: string,
  numBandas: number,
  relacionAg: number | null,
  arduinoConectado: boolean,
  colorLuz: string,
): void {
  const agTxt =
    relacionAg !== null ? ` | Relacion A/G: ${relacionAg.toFixed(2)}` : "";
  const estadoLuz = arduinoConectado ? `LUZ ${colorLuz}` : "SIN ARDUINO";

  ctx.fillStyle = "rgba(15, 15, 15, 0.88)";
  ctx.fillRect(10, 10, ANCHO_NATIVO - 20, 66);
  ctx.strokeStyle = "rgb(70, 70, 70)";
  ctx.lineWidth = 1;
  ctx.strokeRect(10, 10, ANCHO_NATIVO - 20, 66);

  ctx.font = "600 14px sans-serif";
  ctx.fillStyle = "#22c55e";
  ctx.fillText(
    `Densitometro Celogel | Tincion: ${modoTincion} | Fracciones: ${numBandas}${agTxt} | ${estadoLuz}`,
    20,
    35,
  );

  ctx.font = "13px sans-serif";
  ctx.fillStyle = "#22d3ee";
  ctx.fillText(
    "Arrastra el recuadro verde sobre la tira  |  [ESPACIO] Capturar tira  |  [ESC] Cerrar",
    20,
    60,
  );
}

export default function ModalCabinaDensitometro({
  abierto,
  onCerrar,
  onCapturaExitosa,
  onUsarCamaraWeb,
}: Props) {
  if (!abierto) return null;
  return (
    <ContenidoModalCabina
      onCerrar={onCerrar}
      onCapturaExitosa={onCapturaExitosa}
      onUsarCamaraWeb={onUsarCamaraWeb}
    />
  );
}

function ContenidoModalCabina({
  onCerrar,
  onCapturaExitosa,
  onUsarCamaraWeb,
}: Omit<Props, "abierto">) {
  const [modoConexion, setModoConexion] = useState<ModoConexion | null>(() =>
    debeIntentarBridgeLocal() ? null : "navegador",
  );
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [roi, setRoi] = useState<[number, number, number, number]>(ROI_INICIAL);
  const [modoTincion, setModoTincion] = useState<string>("ROJA");

  // Estado modo servidor Python local
  const [estadoServidor, setEstadoServidor] = useState<EstadoCabina | null>(
    null,
  );
  const [camarasServidor, setCamarasServidor] = useState<CamaraInfo[]>([]);
  const [camaraServidorIdx, setCamaraServidorIdx] = useState<number>(0);
  const [streamSrc, setStreamSrc] = useState<string>("");

  // Estado modo navegador directo (WebRTC + Web Serial)
  const [camarasWeb, setCamarasWeb] = useState<CamaraWebInfo[]>([]);
  const [camaraWebId, setCamaraWebId] = useState<string>("");
  const [camaraWebLista, setCamaraWebLista] = useState(false);
  const [webSerialDisponible] = useState<boolean>(() => soportaWebSerial());
  const [arduinoWebConectado, setArduinoWebConectado] = useState(false);
  const [arduinoWebColor, setArduinoWebColor] = useState<string>("VERDE");
  const [arduinoConectando, setArduinoConectando] = useState(false);
  const [avisoArduino, setAvisoArduino] = useState<string | null>(null);

  // Refs de UI, cámara y ciclo de dibujo
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const outImageDataRef = useRef<ImageData | null>(null);
  const mapaRef = useRef<MapaUndistort | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const arduinoRef = useRef<ControladorArduinoWeb | null>(null);

  const roiRef = useRef(roi);
  const modoTincionRef = useRef(modoTincion);
  const arduinoWebConectadoRef = useRef(arduinoWebConectado);
  const arduinoWebColorRef = useRef(arduinoWebColor);
  const cargandoRef = useRef(cargando);
  const modoConexionRef = useRef(modoConexion);

  useEffect(() => {
    roiRef.current = roi;
  }, [roi]);
  useEffect(() => {
    modoTincionRef.current = modoTincion;
  }, [modoTincion]);
  useEffect(() => {
    arduinoWebConectadoRef.current = arduinoWebConectado;
  }, [arduinoWebConectado]);
  useEffect(() => {
    arduinoWebColorRef.current = arduinoWebColor;
  }, [arduinoWebColor]);
  useEffect(() => {
    cargandoRef.current = cargando;
  }, [cargando]);
  useEffect(() => {
    modoConexionRef.current = modoConexion;
  }, [modoConexion]);

  const draggingRef = useRef<{
    tipo: "mover" | "se" | "sw" | "ne" | "nw" | "e" | "s" | "w" | "n";
    startX: number;
    startY: number;
    startRoi: [number, number, number, number];
  } | null>(null);

  const detenerStreams = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const abrirStreamCamaraWeb = useCallback(
    async (
      deviceIdObjetivo?: string,
    ): Promise<{
      stream: MediaStream;
      camaraElegida: CamaraWebInfo | null;
      lista: CamaraWebInfo[];
    }> => {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Este navegador no permite acceder a la cámara USB directamente.",
        );
      }

      const preferida = deviceIdObjetivo || leerCamaraPreferida();
      const constraintsInicial: MediaStreamConstraints = {
        video: preferida
          ? {
              deviceId: { ideal: preferida },
              width: { ideal: ANCHO_CAPTURA },
              height: { ideal: ALTO_CAPTURA },
            }
          : {
              width: { ideal: ANCHO_CAPTURA },
              height: { ideal: ALTO_CAPTURA },
            },
        audio: false,
      };

      let stream = await navigator.mediaDevices.getUserMedia(constraintsInicial);
      const lista = await listarCamarasWeb();

      const trackActual = stream.getVideoTracks()[0];
      const activeId = trackActual?.getSettings().deviceId;
      const elegida = deviceIdObjetivo
        ? lista.find((c) => c.deviceId === deviceIdObjetivo) ?? null
        : elegirCamaraCabina(lista, preferida);

      if (elegida && elegida.deviceId && elegida.deviceId !== activeId) {
        stream.getTracks().forEach((t) => t.stop());
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: elegida.deviceId },
            width: { ideal: ANCHO_CAPTURA },
            height: { ideal: ALTO_CAPTURA },
          },
          audio: false,
        });
      }

      if (elegida?.deviceId) {
        guardarCamaraPreferida(elegida.deviceId);
      }

      return { stream, camaraElegida: elegida, lista };
    },
    [],
  );

  // Detectar si hay bridge Python en localhost (cuando aplica) y limpiar al desmontar
  useEffect(() => {
    let cancelado = false;

    if (modoConexion === null) {
      consultarEstadoCabina(1200).then((est) => {
        if (cancelado) return;
        if (est?.disponible) {
          setModoConexion("servidor");
          setEstadoServidor(est);
          if (est.camaras_disponibles && est.camaras_disponibles.length > 0) {
            setCamarasServidor(est.camaras_disponibles);
          }
          if (typeof est.camara_actual === "number") {
            setCamaraServidorIdx(est.camara_actual);
          }
          if (est.roi_actual && est.roi_actual.length === 4) {
            setRoi([
              est.roi_actual[0],
              est.roi_actual[1],
              est.roi_actual[2],
              est.roi_actual[3],
            ]);
          }
          if (est.modo_tincion) {
            setModoTincion(est.modo_tincion);
          }
          setStreamSrc(urlStreamVideo());
        } else {
          setModoConexion("navegador");
        }
      });
    }

    return () => {
      cancelado = true;
    };
  }, [modoConexion]);

  useEffect(() => {
    return () => {
      detenerStreams();
      if (arduinoRef.current) {
        arduinoRef.current.destruir();
        arduinoRef.current = null;
      }
    };
  }, [detenerStreams]);

  // Arranque del hardware en Modo Navegador Directo (cámara + autoconexión Arduino)
  useEffect(() => {
    if (modoConexion !== "navegador") {
      detenerStreams();
      return;
    }

    let cancelado = false;

    const iniciarCamaraWeb = async () => {
      try {
        const { stream, camaraElegida, lista } = await abrirStreamCamaraWeb();
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setCamarasWeb(lista);
        if (camaraElegida) {
          setCamaraWebId(camaraElegida.deviceId);
        } else if (lista[0]) {
          setCamaraWebId(lista[0].deviceId);
        }

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
          if (!cancelado) setCamaraWebLista(true);
        }
      } catch (err) {
        if (!cancelado) {
          setError(describirErrorCamara(err));
        }
      }
    };

    const iniciarArduinoWeb = async () => {
      if (!soportaWebSerial()) return;
      if (!arduinoRef.current) {
        arduinoRef.current = new ControladorArduinoWeb();
      }
      const ctrl = arduinoRef.current;
      const ok = await ctrl.intentarAutoconectar(modoTincionRef.current);
      if (!cancelado && ok) {
        setArduinoWebConectado(true);
        setArduinoWebColor(ctrl.colorActivo);
      }
    };

    void iniciarCamaraWeb();
    void iniciarArduinoWeb();

    return () => {
      cancelado = true;
      detenerStreams();
    };
  }, [modoConexion, abrirStreamCamaraWeb, detenerStreams]);

  // Bucle de renderizado en vivo (corrección óptica + curva densitométrica + HUD)
  useEffect(() => {
    if (modoConexion !== "navegador" || !camaraWebLista) {
      return;
    }

    let activo = true;
    const renderFrame = () => {
      if (!activo) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (
        video &&
        canvas &&
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        const srcW = video.videoWidth;
        const srcH = video.videoHeight;

        if (
          !rawCanvasRef.current ||
          rawCanvasRef.current.width !== srcW ||
          rawCanvasRef.current.height !== srcH
        ) {
          const off = document.createElement("canvas");
          off.width = srcW;
          off.height = srcH;
          rawCanvasRef.current = off;
          mapaRef.current = construirMapaUndistort(
            srcW,
            srcH,
            ANCHO_NATIVO,
            ALTO_NATIVO,
          );
        }

        const rawCtx = rawCanvasRef.current.getContext("2d", {
          willReadFrequently: true,
        });
        const ctx = canvas.getContext("2d");
        const mapa = mapaRef.current;

        if (rawCtx && ctx && mapa) {
          if (!outImageDataRef.current) {
            outImageDataRef.current = ctx.createImageData(
              ANCHO_NATIVO,
              ALTO_NATIVO,
            );
          }

          rawCtx.drawImage(video, 0, 0, srcW, srcH);
          const rawPixels = rawCtx.getImageData(0, 0, srcW, srcH).data;
          const outImg = outImageDataRef.current;

          aplicarUndistortRapido(rawPixels, outImg.data, mapa);

          const roiActual = roiRef.current;
          const tincionActual = modoTincionRef.current;
          const analisis = procesarRoiEnVivo(
            outImg.data,
            ANCHO_NATIVO,
            ALTO_NATIVO,
            roiActual,
            tincionActual,
          );

          ctx.putImageData(outImg, 0, 0);
          dibujarGraficaYAreasCanvas(ctx, ALTO_NATIVO, roiActual, analisis);

          const ctrl = arduinoRef.current;
          const conectado = Boolean(ctrl?.conectado);
          if (conectado !== arduinoWebConectadoRef.current) {
            setArduinoWebConectado(conectado);
          }
          dibujarHudCanvas(
            ctx,
            tincionActual,
            analisis.datosBandas.length,
            analisis.relacionAg,
            conectado,
            ctrl?.colorActivo ?? arduinoWebColorRef.current,
          );
        }
      }

      if (activo) {
        rafRef.current = requestAnimationFrame(renderFrame);
      }
    };

    rafRef.current = requestAnimationFrame(renderFrame);
    return () => {
      activo = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [modoConexion, camaraWebLista]);

  const ejecutarCaptura = useCallback(async () => {
    if (cargandoRef.current) return;
    setCargando(true);
    setError(null);

    try {
      if (modoConexionRef.current === "servidor") {
        const res = await capturaLimpiaCabina();
        if (!res.archivo) {
          throw new Error("No se obtuvo la imagen capturada.");
        }
        await onCapturaExitosa(res.archivo);
        onCerrar();
        return;
      }

      const video = videoRef.current;
      const rawCanvas = rawCanvasRef.current;
      const mapa = mapaRef.current;
      if (!video || !rawCanvas || !mapa || video.readyState < 2) {
        throw new Error("La cámara todavía no está lista para capturar.");
      }
      const rawCtx = rawCanvas.getContext("2d", { willReadFrequently: true });
      if (!rawCtx) {
        throw new Error("No se pudo acceder al buffer de video.");
      }

      const numFrames = 10;
      const totalPix = ANCHO_NATIVO * ALTO_NATIVO;
      const acumulador = new Float32Array(totalPix * 3);

      for (let f = 0; f < numFrames; f++) {
        await esperarCuadroVideo(video);
        rawCtx.drawImage(video, 0, 0, mapa.srcW, mapa.srcH);
        const rawPixels = rawCtx.getImageData(0, 0, mapa.srcW, mapa.srcH).data;
        acumularUndistortBilineal(rawPixels, acumulador, mapa);
      }

      const limpioCanvas = document.createElement("canvas");
      limpioCanvas.width = ANCHO_NATIVO;
      limpioCanvas.height = ALTO_NATIVO;
      const limpioCtx = limpioCanvas.getContext("2d");
      if (!limpioCtx) {
        throw new Error("No se pudo generar la imagen limpia.");
      }

      const imgPromediada = limpioCtx.createImageData(
        ANCHO_NATIVO,
        ALTO_NATIVO,
      );
      const dst = imgPromediada.data;
      for (let i = 0; i < totalPix; i++) {
        const aOff = i * 3;
        const dOff = i * 4;
        dst[dOff] = Math.min(255, Math.round(acumulador[aOff] / numFrames));
        dst[dOff + 1] = Math.min(
          255,
          Math.round(acumulador[aOff + 1] / numFrames),
        );
        dst[dOff + 2] = Math.min(
          255,
          Math.round(acumulador[aOff + 2] / numFrames),
        );
        dst[dOff + 3] = 255;
      }
      limpioCtx.putImageData(imgPromediada, 0, 0);

      const [x1, y1, x2, y2] = roiRef.current;
      const anchoRoi = Math.max(10, x2 - x1);
      const altoRoi = Math.max(10, y2 - y1);

      const recorteCanvas = document.createElement("canvas");
      recorteCanvas.width = anchoRoi;
      recorteCanvas.height = altoRoi;
      const recorteCtx = recorteCanvas.getContext("2d");
      if (!recorteCtx) {
        throw new Error("No se pudo recortar el área de la tira.");
      }
      recorteCtx.drawImage(
        limpioCanvas,
        x1,
        y1,
        anchoRoi,
        altoRoi,
        0,
        0,
        anchoRoi,
        altoRoi,
      );

      const blob = await new Promise<Blob | null>((resolve) =>
        recorteCanvas.toBlob(resolve, "image/png"),
      );
      if (!blob) {
        throw new Error("No se pudo codificar la imagen PNG de la tira.");
      }

      const archivo = new File([blob], `tira_cabina_${Date.now()}.png`, {
        type: "image/png",
      });
      await onCapturaExitosa(archivo);
      onCerrar();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Error al capturar la tira de la cabina.";
      setError(msg);
    } finally {
      setCargando(false);
    }
  }, [onCapturaExitosa, onCerrar]);

  // Atajos de teclado [ESPACIO] y [ESC] con referencias siempre frescas
  const ejecutarCapturaRef = useRef(ejecutarCaptura);
  const onCerrarRef = useRef(onCerrar);
  useEffect(() => {
    ejecutarCapturaRef.current = ejecutarCaptura;
  }, [ejecutarCaptura]);
  useEffect(() => {
    onCerrarRef.current = onCerrar;
  }, [onCerrar]);

  useEffect(() => {
    const manejarTeclado = (e: KeyboardEvent) => {
      if (e.code === "Space" && !cargandoRef.current) {
        e.preventDefault();
        void ejecutarCapturaRef.current();
      } else if (e.key === "Escape") {
        onCerrarRef.current();
      }
    };
    window.addEventListener("keydown", manejarTeclado);
    return () => window.removeEventListener("keydown", manejarTeclado);
  }, []);

  async function cambiarCamaraServidor(idx: number) {
    setCamaraServidorIdx(idx);
    await ajustarCabina({ camara_idx: idx });
    setStreamSrc(urlStreamVideo());
  }

  async function cambiarCamaraWeb(deviceId: string) {
    setError(null);
    setCamaraWebLista(false);
    setCamaraWebId(deviceId);
    detenerStreams();
    try {
      const { stream, camaraElegida, lista } =
        await abrirStreamCamaraWeb(deviceId);
      streamRef.current = stream;
      setCamarasWeb(lista);
      if (camaraElegida) setCamaraWebId(camaraElegida.deviceId);
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
        setCamaraWebLista(true);
      }
    } catch (err) {
      setError(describirErrorCamara(err));
    }
  }

  async function cambiarTincion(modo: string) {
    setModoTincion(modo);
    if (modoConexion === "servidor") {
      await ajustarCabina({ modo_tincion: modo });
      const est = await consultarEstadoCabina();
      if (est) setEstadoServidor(est);
      return;
    }

    const ctrl = arduinoRef.current;
    if (ctrl?.conectado) {
      await ctrl.configurarEspectroTincion(modo);
      setArduinoWebColor(ctrl.colorActivo);
    }
  }

  async function conectarArduinoManual() {
    setAvisoArduino(null);
    setArduinoConectando(true);
    try {
      if (!arduinoRef.current) {
        arduinoRef.current = new ControladorArduinoWeb();
      }
      const ok = await arduinoRef.current.conectarConSelector(
        modoTincionRef.current,
      );
      setArduinoWebConectado(ok);
      if (ok) {
        setArduinoWebColor(arduinoRef.current.colorActivo);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotFoundError") {
        return;
      }
      const msg =
        err instanceof Error
          ? err.message
          : "No se pudo abrir el puerto COM del Arduino.";
      setAvisoArduino(msg);
    } finally {
      setArduinoConectando(false);
    }
  }

  async function desconectarArduinoManual() {
    if (arduinoRef.current) {
      await arduinoRef.current.desconectar();
      setArduinoWebConectado(false);
    }
  }

  async function alternarBridgeLocal() {
    setError(null);
    if (modoConexion === "navegador") {
      const est = await consultarEstadoCabina(2000);
      if (!est?.disponible) {
        setError(
          "No se encontró ningún servidor Python local de cabina corriendo en http://127.0.0.1:8000.",
        );
        return;
      }
      setCamaraWebLista(false);
      detenerStreams();
      if (arduinoRef.current) {
        await arduinoRef.current.desconectar();
        setArduinoWebConectado(false);
      }
      setModoConexion("servidor");
      setEstadoServidor(est);
      if (est.camaras_disponibles) setCamarasServidor(est.camaras_disponibles);
      if (typeof est.camara_actual === "number") {
        setCamaraServidorIdx(est.camara_actual);
      }
      setStreamSrc(urlStreamVideo());
    } else {
      setStreamSrc("");
      setModoConexion("navegador");
    }
  }

  function iniciarArrastre(
    tipo: "mover" | "se" | "sw" | "ne" | "nw" | "e" | "s" | "w" | "n",
    e: ReactPointerEvent,
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
      if (tipo.includes("e"))
        x2 = Math.min(ANCHO_NATIVO, Math.max(x1 + 40, x2 + dx));
      if (tipo.includes("s"))
        y2 = Math.min(ALTO_NATIVO, Math.max(y1 + 20, y2 + dy));
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
    if (modoConexion === "servidor") {
      await ajustarCabina({ roi: roiRef.current });
    }
  }

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
                Arrastrá el recuadro verde para ubicar la tira • Análisis
                densitométrico en tiempo real
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {modoConexion !== null && (
              <button
                type="button"
                onClick={() => void alternarBridgeLocal()}
                className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-[11px] text-gray-300 hover:bg-gray-800 hover:text-white"
                title="Cambiar entre acceso USB directo desde el navegador y servidor Python local"
              >
                {modoConexion === "navegador"
                  ? "USB directo (Web)"
                  : "Servidor local (:8000)"}
              </button>
            )}
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
          <video ref={videoRef} playsInline muted autoPlay className="hidden" />

          {modoConexion === "navegador" ? (
            <>
              <canvas
                ref={canvasRef}
                width={ANCHO_NATIVO}
                height={ALTO_NATIVO}
                className="w-full h-full object-contain pointer-events-none select-none"
              />
              {!camaraWebLista && !error && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 text-gray-300 text-sm">
                  Iniciando cámara USB del navegador...
                </div>
              )}
            </>
          ) : modoConexion === "servidor" && streamSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={streamSrc}
              alt="Transmisión en vivo"
              className="w-full h-full object-contain pointer-events-none select-none"
              onError={() => {
                setError(
                  "No se pudo cargar el video del servidor local. Verificá la conexión USB o cambiá a USB directo.",
                );
              }}
            />
          ) : (
            <div className="text-gray-400 text-sm">Detectando cabina...</div>
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
            <div className="absolute -top-5 left-0 rounded bg-emerald-700/90 px-1.5 py-0.2 text-[9px] font-semibold text-white pointer-events-none">
              Alineación de Tira
            </div>

            <div
              onPointerDown={(e) => iniciarArrastre("se", e)}
              className="absolute -bottom-2 -right-2 h-4 w-4 rounded-sm bg-white border-2 border-emerald-600 cursor-se-resize shadow-md hover:scale-125 transition-transform"
              title="Arrastrar para redimensionar"
            />
            <div
              onPointerDown={(e) => iniciarArrastre("sw", e)}
              className="absolute -bottom-1.5 -left-1.5 h-3 w-3 rounded-sm bg-white border border-emerald-600 cursor-sw-resize hover:scale-125"
            />
            <div
              onPointerDown={(e) => iniciarArrastre("ne", e)}
              className="absolute -top-1.5 -right-1.5 h-3 w-3 rounded-sm bg-white border border-emerald-600 cursor-ne-resize hover:scale-125"
            />
            <div
              onPointerDown={(e) => iniciarArrastre("e", e)}
              className="absolute top-1/2 -right-1.5 -translate-y-1/2 h-5 w-2 rounded-xs bg-emerald-300 border border-emerald-700 cursor-e-resize"
              title="Ajustar ancho"
            />
          </div>

          {cargando && (
            <div className="absolute inset-0 bg-black/75 z-30 flex flex-col items-center justify-center text-white backdrop-blur-xs">
              <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
              <p className="mt-2 text-sm font-medium">
                Capturando fotograma limpio (10 cuadros promediados)...
              </p>
            </div>
          )}
        </div>

        {(error || avisoArduino) && (
          <div className="bg-red-950 border-y border-red-800 px-4 py-1.5 text-xs text-red-200">
            {error || avisoArduino}
          </div>
        )}

        {/* Barra de Controles Inferior */}
        <div className="bg-gray-950 border-t border-gray-800 p-3 sm:px-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Selector de Cámara Inteligente */}
            <div className="flex items-center gap-2">
              <span className="text-gray-400 font-medium">Cámara:</span>
              {modoConexion === "servidor" ? (
                <select
                  value={camaraServidorIdx}
                  onChange={(e) =>
                    void cambiarCamaraServidor(Number(e.target.value))
                  }
                  className="max-w-[230px] rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {camarasServidor.length > 0 ? (
                    camarasServidor.map((c) => (
                      <option key={c.idx} value={c.idx}>
                        {c.nombre} {c.idx === camaraServidorIdx ? "✓" : ""}
                      </option>
                    ))
                  ) : (
                    <option value={0}>USB CAMERA (Cabina)</option>
                  )}
                </select>
              ) : (
                <select
                  value={camaraWebId}
                  onChange={(e) => void cambiarCamaraWeb(e.target.value)}
                  className="max-w-[230px] rounded-lg bg-gray-800 border border-gray-700 px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {camarasWeb.length > 0 ? (
                    camarasWeb.map((c) => (
                      <option key={c.deviceId} value={c.deviceId}>
                        {c.nombre} {c.deviceId === camaraWebId ? "✓" : ""}
                      </option>
                    ))
                  ) : (
                    <option value="">Detectando cámaras USB...</option>
                  )}
                </select>
              )}
            </div>

            {/* Selector de Tinción / Contraste con LEDs */}
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 font-medium">Tinción / LEDs:</span>
              <button
                type="button"
                onClick={() => void cambiarTincion("ROJA")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  modoTincion === "ROJA"
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
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  modoTincion === "AZUL"
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
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  modoTincion === "BLANCA"
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
            <div className="flex items-center gap-2 text-[11px] text-gray-400">
              {modoConexion === "servidor" ? (
                estadoServidor?.arduino_conectado ? (
                  <span className="text-emerald-400 font-medium">
                    💡 LEDs en {estadoServidor.color_luz_activo}
                  </span>
                ) : (
                  <span className="text-amber-500/80">
                    (Arduino COM no detectado)
                  </span>
                )
              ) : arduinoWebConectado ? (
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-medium">
                    💡 LEDs en {arduinoWebColor} (USB)
                  </span>
                  <button
                    type="button"
                    onClick={() => void desconectarArduinoManual()}
                    className="rounded border border-gray-700 px-1.5 py-0.5 text-[10px] text-gray-300 hover:bg-gray-800"
                  >
                    Desconectar
                  </button>
                </div>
              ) : webSerialDisponible ? (
                <button
                  type="button"
                  onClick={() => void conectarArduinoManual()}
                  disabled={arduinoConectando}
                  className="rounded-md bg-amber-600/90 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                  title="Autorizar el puerto USB/COM del Arduino (solo hace falta la primera vez)"
                >
                  {arduinoConectando
                    ? "Conectando COM..."
                    : "🔌 Conectar Arduino (COM)"}
                </button>
              ) : (
                <span className="text-amber-500/80">
                  (Arduino web requiere Chrome/Edge)
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
