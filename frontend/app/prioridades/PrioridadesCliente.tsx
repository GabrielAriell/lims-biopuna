"use client";

import { useMemo } from "react";

import MarcoDashboard from "@/components/MarcoDashboard";
import { construirAlertasCriticas } from "@/lib/alertas";
import { useMuestras } from "@/hooks/useMuestras";
import type { EstadoMuestra } from "@/lib/tipos-muestras";

const ESTADOS: { clave: EstadoMuestra; titulo: string; detalle: string; clase: string }[] = [
  { clave: "verde", titulo: "En plazo", detalle: "menos de 24 h", clase: "border-green-300 bg-green-50 text-green-900" },
  { clave: "amarillo", titulo: "Atención", detalle: "entre 24 y 40 h", clase: "border-yellow-300 bg-yellow-50 text-yellow-900" },
  { clave: "rojo", titulo: "Fuera de plazo", detalle: "más de 40 h", clase: "border-red-300 bg-red-50 text-red-900" },
  { clave: "procesada", titulo: "Procesadas", detalle: "ya tienen ensayo", clase: "border-gray-300 bg-gray-100 text-gray-800" },
];

export default function PrioridadesCliente() {
  const { muestras, cargando, actualizando, error, recargar } = useMuestras();

  const resumen = useMemo(() => {
    const cuenta: Record<EstadoMuestra, number> = {
      verde: 0,
      amarillo: 0,
      rojo: 0,
      procesada: 0,
    };
    for (const m of muestras) cuenta[m.estado_48h] += 1;
    return cuenta;
  }, [muestras]);

  const criticas = useMemo(() => construirAlertasCriticas(muestras), [muestras]);

  return (
    <MarcoDashboard
      activa="prioridades"
      titulo="Prioridades y Semáforo Biológico (48 Horas)"
      subtitulo="Monitoreo de viabilidad celular y cola de prioridades Lean FIFO para la corrida electroforética."
    >
      <div className="space-y-6 max-w-7xl">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 shadow-xs">
            {error}
          </div>
        )}

        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">Prioridades y semáforo (48 h)</h1>
            </div>
            <button
              onClick={recargar}
              disabled={actualizando || cargando}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actualizando ? "Actualizando..." : "Actualizar"}
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ESTADOS.map((e) => (
              <div key={e.clave} className={`rounded-lg border p-4 ${e.clase}`}>
                <p className="text-sm font-medium">{e.titulo}</p>
                <p className="text-2xl font-bold">{cargando ? "…" : resumen[e.clave]}</p>
                <p className="text-xs">{e.detalle}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          aria-label="Cola de riesgo crítico"
          className="rounded-xl border border-red-300 bg-red-50 p-5 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-red-900">
            Riesgo crítico (priorizar)
          </h2>
          <p className="mt-1 text-sm text-red-800">
            Muestras pendientes (sin ensayo) con más de 40 h y hasta 48 h desde la extracción. Al superar 48 h la notificación desaparece.
          </p>

          {cargando ? (
            <p className="mt-3 text-sm text-gray-700">Cargando…</p>
          ) : criticas.length === 0 ? (
            <p className="mt-3 rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-gray-700">
              No hay muestras en riesgo crítico en este momento.
            </p>
          ) : (
            <>
              <p className="mt-3 text-sm font-medium text-red-900">
                ⚠ {criticas.length}{" "}
                {criticas.length === 1 ? "muestra en riesgo crítico" : "muestras en riesgo crítico"}
              </p>
              <ul className="mt-2 space-y-2">
                {criticas.map((alerta) => (
                  <li
                    key={alerta.clave}
                    className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-gray-800"
                  >
                    <p className="font-medium text-red-900">
                      [{alerta.muestra.codigo_animal}] · {alerta.muestra.localidad_puna} · cumple{" "}
                      {alerta.muestra.horas_transcurridas.toFixed(1)} h desde la extracción.
                    </p>
                    <p className="text-red-800">
                      Priorizar corrida electroforética inmediatamente.
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </MarcoDashboard>
  );
}
