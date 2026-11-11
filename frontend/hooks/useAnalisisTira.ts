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
  };
}
