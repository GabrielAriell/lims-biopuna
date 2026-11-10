"use client";

import { useRef, useState } from "react";

import { recalcularLimites } from "@/lib/api";
import { cortesDesdeFracciones, zonasDesdeCortes } from "@/lib/limites";
import type { CalculoLimites, Carril } from "@/lib/tipos";

// Estado de los límites de un carril. Mientras no se toque nada, usa la
// propuesta automática; al mover un corte, recalcula con la API.
export function useAjusteLimites(
  carril: Carril,
  proteinasTotales: string,
  onAjuste?: (calculo: CalculoLimites | null) => void,
) {
  const [cortes, setCortes] = useState<number[] | null>(null);
  const [calculo, setCalculo] = useState<CalculoLimites | null>(null);
  const [recalculando, setRecalculando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const peticion = useRef(0);

  const cortesActuales = cortes ?? cortesDesdeFracciones(carril);

  function cambiar(nuevos: number[]) {
    setCortes(nuevos);
    setError(null);
  }

  async function aplicar(nuevos: number[]) {
    const id = ++peticion.current;
    setRecalculando(true);
    setError(null);
    try {
      const resultado = await recalcularLimites(
        carril.perfil,
        zonasDesdeCortes(nuevos),
        proteinasTotales,
      );
      if (id === peticion.current) {
        setCalculo(resultado);
        onAjuste?.(resultado);
      }
    } catch (e) {
      if (id === peticion.current) {
        setError(e instanceof Error ? e.message : "No se pudo recalcular");
      }
    } finally {
      if (id === peticion.current) setRecalculando(false);
    }
  }

  function restablecer() {
    peticion.current += 1; // descarta una respuesta que ya no corresponde
    setCortes(null);
    setCalculo(null);
    setError(null);
    setRecalculando(false);
    onAjuste?.(null);
  }

  return {
    cortes: cortesActuales,
    calculo,
    recalculando,
    error,
    ajustado: cortes !== null || calculo !== null,
    cambiar,
    aplicar,
    restablecer,
  };
}
