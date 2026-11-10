"use client";

import { useCallback, useMemo, useState } from "react";

import { construirAlertas } from "@/lib/alertas";
import type { Muestra } from "@/lib/tipos-muestras";

export function useAlertasMuestras(muestras: Muestra[]) {
  // Los descartes viven solo en memoria: si se recarga la página, los avisos
  // urgentes vuelven a aparecer. Preferimos eso antes que ocultar una muestra
  // vencida para siempre.
  const [descartadas, setDescartadas] = useState<Set<string>>(new Set());

  const alertas = useMemo(() => construirAlertas(muestras), [muestras]);

  const urgentes = useMemo(
    () => alertas.filter((alerta) => alerta.nivel !== "atencion"),
    [alertas],
  );

  const visibles = useMemo(
    () => urgentes.filter((alerta) => !descartadas.has(alerta.clave)),
    [urgentes, descartadas],
  );

  const enAtencion = useMemo(
    () => alertas.filter((alerta) => alerta.nivel === "atencion").length,
    [alertas],
  );

  const descartar = useCallback((clave: string) => {
    setDescartadas((previas) => new Set(previas).add(clave));
  }, []);

  return { visibles, enAtencion, descartar };
}
