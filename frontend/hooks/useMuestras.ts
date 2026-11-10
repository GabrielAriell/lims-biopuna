"use client";

import { useCallback, useEffect, useState } from "react";

import { listarCampanas, listarMuestras } from "@/lib/api-muestras";
import type { Campana, Muestra } from "@/lib/tipos-muestras";

// El semáforo lo calcula la base con la hora actual, así que conviene
// refrescar la tabla cada minuto aunque el usuario no toque nada.
const REFRESCO_MS = 60_000;

export function useMuestras() {
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [muestras, setMuestras] = useState<Muestra[]>([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // No cambia el estado antes del primer await: así el efecto de montaje
  // no dispara renders en cascada.
  const cargar = useCallback(async () => {
    try {
      const [nuevasCampanas, nuevasMuestras] = await Promise.all([
        listarCampanas(),
        listarMuestras(),
      ]);
      setCampanas(nuevasCampanas);
      setMuestras(nuevasMuestras);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setCargando(false);
    }
  }, []);

  const recargar = useCallback(async () => {
    setActualizando(true);
    await cargar();
    setActualizando(false);
  }, [cargar]);

  useEffect(() => {
    // La primera carga se difiere al próximo tick para no actualizar estado
    // durante el montaje; el intervalo mantiene el semáforo al día.
    const inicio = window.setTimeout(cargar, 0);
    const intervalo = window.setInterval(cargar, REFRESCO_MS);
    return () => {
      window.clearTimeout(inicio);
      window.clearInterval(intervalo);
    };
  }, [cargar]);

  return { campanas, muestras, cargando, actualizando, error, recargar };
}
