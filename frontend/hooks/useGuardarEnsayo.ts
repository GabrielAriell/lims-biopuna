"use client";

import { useCallback, useState } from "react";

import { guardarEnsayo } from "@/lib/api-ensayos";
import type { EnsayoGuardado, NuevoEnsayo } from "@/lib/tipos-ensayos";

// Estado del guardado: en curso, error y último ensayo guardado.
export function useGuardarEnsayo() {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<EnsayoGuardado | null>(null);

  const guardar = useCallback(async (datos: NuevoEnsayo, imagen: Blob) => {
    setGuardando(true);
    setError(null);
    try {
      const ensayo = await guardarEnsayo(datos, imagen);
      setGuardado(ensayo);
      return ensayo;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el ensayo");
      return null;
    } finally {
      setGuardando(false);
    }
  }, []);

  const reiniciar = useCallback(() => {
    setError(null);
    setGuardado(null);
  }, []);

  return { guardar, guardando, error, guardado, reiniciar };
}
