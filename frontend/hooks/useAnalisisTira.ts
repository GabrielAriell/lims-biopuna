"use client";

import { useRef, useState } from "react";
import type { PixelCrop } from "react-image-crop";

import { analizarTira } from "@/lib/api";
import { PARAMETROS_INICIALES } from "@/lib/config";
import { prepararImagenParaAnalisis, recortarArchivo } from "@/lib/recorte";
import type { AnalisisTira, Parametros } from "@/lib/tipos";

type Recorte = { crop: PixelCrop | undefined; imagen: HTMLImageElement | null };
const SIN_RECORTE: Recorte = { crop: undefined, imagen: null };

// Toda la lógica de la pantalla de análisis: archivo, recorte, llamada a la
// API, resultado y errores. La página solo muestra lo que este hook entrega.
export function useAnalisisTira() {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [urlVista, setUrlVista] = useState<string | null>(null);
  const [parametros, setParametros] = useState<Parametros>(PARAMETROS_INICIALES);
  const [resultado, setResultado] = useState<AnalisisTira | null>(null);
  const [version, setVersion] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorte = useRef<Recorte>(SIN_RECORTE);

  async function elegirArchivo(nuevo: File | null) {
    if (urlVista) URL.revokeObjectURL(urlVista);
    setArchivo(null);
    setUrlVista(null);
    setResultado(null);
    setError(null);
    recorte.current = SIN_RECORTE;
    if (!nuevo) return;
    setPreparando(true);
    try {
      // Reducir imágenes grandes (p. ej. fotos de celular) para evitar problemas
      // de memoria al mostrar/recortar/analizar.
      const preparado = await prepararImagenParaAnalisis(nuevo);
      setArchivo(preparado);
      setUrlVista(URL.createObjectURL(preparado));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo preparar la imagen");
    } finally {
      setPreparando(false);
    }
  }

  function fijarRecorte(crop: PixelCrop | undefined, imagen: HTMLImageElement | null) {
    recorte.current = { crop, imagen };
  }

  async function analizar() {
    if (!archivo) return;
    setCargando(true);
    setError(null);
    try {
      const { crop, imagen } = recorte.current;
      let nuevo: AnalisisTira;
      if (crop && imagen) {
        const recortada = await recortarArchivo(imagen, crop, archivo.name);
        // Con recorte manual se respeta el recuadro: se pasa la región completa
        // de la imagen recortada (si la tira está parada, ancho y alto se cruzan).
        const { ancho, alto } = recortada;
        const region = parametros.vertical ? `0,0,${alto},${ancho}` : `0,0,${ancho},${alto}`;
        nuevo = await analizarTira(recortada.archivo, parametros, region);
      } else {
        nuevo = await analizarTira(archivo, parametros);
      }
      setResultado(nuevo);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setCargando(false);
    }
  }

  async function transformarImagen(tipo: "izq" | "der" | "espejo") {
    if (!archivo || !urlVista) return;
    const img = new Image();
    img.src = urlVista;
    await img.decode();

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (tipo === "espejo") {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    } else {
      canvas.width = img.naturalHeight;
      canvas.height = img.naturalWidth;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((tipo === "der" ? 90 : -90) * (Math.PI / 180));
      ctx.translate(-img.naturalWidth / 2, -img.naturalHeight / 2);
    }
    ctx.drawImage(img, 0, 0);

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, archivo.type || "image/png", 0.95),
    );
    if (!blob) return;

    const nuevoArchivo = new File([blob], archivo.name, { type: blob.type });
    URL.revokeObjectURL(urlVista);
    recorte.current = SIN_RECORTE;
    setArchivo(nuevoArchivo);
    setUrlVista(URL.createObjectURL(nuevoArchivo));
  }

  return {
    archivo,
    urlVista,
    parametros,
    setParametros,
    resultado,
    version,
    cargando,
    preparando,
    error,
    elegirArchivo,
    fijarRecorte,
    analizar,
    transformarImagen,
  };
}
