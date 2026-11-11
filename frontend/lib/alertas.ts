// Reglas de aviso del semáforo de 48 h.
//
// No consultan la base: se calculan con las horas que ya devuelve la vista
// `muestra_con_estado`. La vista marca "rojo" desde las 40 h, pero el límite
// real de la muestra son las 48 h; acá distinguimos esos momentos.

import type { Muestra } from "./tipos-muestras";

export const LIMITE_HORAS = 48;
export const UMBRAL_AVISO_HORAS = 40;
export const UMBRAL_ATENCION_HORAS = 24;

export type NivelAlerta = "vencida" | "por_vencer" | "atencion";

export type AlertaMuestra = {
  /** Clave estable para descartar el aviso; cambia si cambia el nivel. */
  clave: string;
  nivel: NivelAlerta;
  muestra: Muestra;
  /** Horas que faltan para las 48 h (negativo si ya venció). */
  horas_restantes: number;
};

export function construirAlertas(muestras: Muestra[]): AlertaMuestra[] {
  return muestras
    .filter(
      (muestra) =>
        muestra.estado_48h !== "procesada" &&
        muestra.horas_transcurridas >= UMBRAL_ATENCION_HORAS,
    )
    .map((muestra) => {
      const horas = muestra.horas_transcurridas;
      const nivel: NivelAlerta =
        horas >= LIMITE_HORAS
          ? "vencida"
          : horas >= UMBRAL_AVISO_HORAS
            ? "por_vencer"
            : "atencion";
      return {
        clave: `${muestra.id_muestra}:${nivel}`,
        nivel,
        muestra,
        horas_restantes: LIMITE_HORAS - horas,
      };
    })
    .sort((a, b) => a.horas_restantes - b.horas_restantes);
}

// Cola proactiva del dashboard: solo pendientes (sin ensayo/procesada) en
// riesgo crítico dentro del plazo (>40 h y <=48 h). Al superar 48 h la
// notificación desaparece. Orden: más urgente primero (menos horas restantes).
export function construirAlertasCriticas(muestras: Muestra[]): AlertaMuestra[] {
  return muestras
    .filter(
      (muestra) =>
        muestra.estado_48h !== "procesada" &&
        muestra.horas_transcurridas > UMBRAL_AVISO_HORAS &&
        muestra.horas_transcurridas <= LIMITE_HORAS,
    )
    .map((muestra) => ({
      clave: `${muestra.id_muestra}:critica`,
      nivel: "por_vencer" as NivelAlerta,
      muestra,
      horas_restantes: LIMITE_HORAS - muestra.horas_transcurridas,
    }))
    .sort((a, b) => a.horas_restantes - b.horas_restantes);
}

export function textoAlerta(alerta: AlertaMuestra): string {
  if (alerta.nivel === "vencida") {
    return `Superó las 48 h hace ${Math.abs(alerta.horas_restantes).toFixed(1)} h.`;
  }
  if (alerta.nivel === "por_vencer") {
    return `Le quedan ${alerta.horas_restantes.toFixed(1)} h para las 48 h.`;
  }
  return `En atención: ${alerta.muestra.horas_transcurridas.toFixed(1)} h desde la extracción.`;
}
