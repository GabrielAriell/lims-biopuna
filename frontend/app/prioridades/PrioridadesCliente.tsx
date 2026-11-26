"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight } from "lucide-react";

import Cargando from "@/components/Cargando";
import MarcoDashboard from "@/components/MarcoDashboard";
import { Button } from "@/components/ui/button";
import { construirAlertasCriticas, LIMITE_HORAS } from "@/lib/alertas";
import { useMuestras } from "@/hooks/useMuestras";
import type { EstadoMuestra } from "@/lib/tipos-muestras";

type EstadoPrioridad = EstadoMuestra | "fuera_de_termino";

const ESTADOS: { clave: EstadoPrioridad; titulo: string; detalle: string; clase: string }[] = [
  { clave: "verde", titulo: "Recientes", detalle: "menos de 24 h", clase: "border-green-300 bg-green-50 text-green-900" },
  { clave: "amarillo", titulo: "Atención", detalle: "entre 24 y 40 h", clase: "border-yellow-300 bg-yellow-50 text-yellow-900" },
  { clave: "rojo", titulo: "Urgente", detalle: "entre 40 y 48 h", clase: "border-red-300 bg-red-50 text-red-900" },
  { clave: "fuera_de_termino", titulo: "Fuera de término", detalle: "más de 48 h", clase: "border-purple-300 bg-purple-50 text-purple-800" },
  { clave: "procesada", titulo: "Completadas", detalle: "ya analizadas", clase: "border-gray-300 bg-gray-100 text-gray-800" },
];

export default function PrioridadesCliente() {
  const { muestras, cargando, actualizando, error, recargar } = useMuestras();

  const resumen = useMemo(() => {
    const cuenta: Record<EstadoPrioridad, number> = {
      verde: 0,
      amarillo: 0,
      rojo: 0,
      fuera_de_termino: 0,
      procesada: 0,
    };
    for (const m of muestras) {
      if (m.estado_48h !== "procesada" && m.horas_transcurridas > LIMITE_HORAS) {
        cuenta.fuera_de_termino += 1;
      } else {
        cuenta[m.estado_48h] += 1;
      }
    }
    return cuenta;
  }, [muestras]);

  const criticas = useMemo(() => construirAlertasCriticas(muestras), [muestras]);

  const enAtencion = useMemo(
    () =>
      muestras
        .filter((m) => m.estado_48h === "amarillo")
        .sort((a, b) => b.horas_transcurridas - a.horas_transcurridas),
    [muestras],
  );

  const recientes = useMemo(
    () =>
      muestras
        .filter((m) => m.estado_48h === "verde")
        .sort((a, b) => b.horas_transcurridas - a.horas_transcurridas),
    [muestras],
  );

  return (
    <MarcoDashboard
      activa="prioridades"
      titulo="Prioridades de Muestras (48h)"
      subtitulo="Control del tiempo transcurrido desde la extracción para analizar cada muestra dentro de las 48 horas."
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 shadow-xs">
            {error}
          </div>
        )}

        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">Estado actual de las muestras (48h)</h1>
            </div>
            <button
              onClick={recargar}
              disabled={actualizando || cargando}
              className="cursor-pointer rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-2xs transition-colors hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actualizando ? "Actualizando..." : "Actualizar"}
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {ESTADOS.map((e) => (
              <div key={e.clave} className={`rounded-lg border p-4 text-center ${e.clase}`}>
                <p className="text-sm font-medium">{e.titulo}</p>
                <p className="text-2xl font-bold">{cargando ? "…" : resumen[e.clave]}</p>
                <p className="text-xs">{e.detalle}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          aria-label="Muestras urgentes"
          className="rounded-xl border border-red-300 bg-red-50 p-5 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-red-900">
            Urgentes (atender primero)
          </h2>
          <p className="mt-1 text-sm text-red-800">
            Muestras pendientes sin analizar con más de 40 horas desde la toma. Conviene analizarlas cuanto antes.
          </p>

          {cargando ? (
            <Cargando texto="Cargando urgentes..." />
          ) : criticas.length === 0 ? (
            <p className="mt-3 rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-gray-700">
              No hay muestras urgentes en este momento.
            </p>
          ) : (
            <>
              <p className="mt-3 text-sm font-medium text-red-900">
                ⚠ {criticas.length}{" "}
                {criticas.length === 1 ? "muestra urgente" : "muestras urgentes"}
              </p>
              <ul className="mt-2 max-h-[21.25rem] space-y-3 overflow-y-auto pr-1">
                {criticas.map((alerta) => {
                  const m = alerta.muestra;
                  return (
                    <li
                      key={alerta.clave}
                      className="flex flex-col gap-3 rounded-xl border border-red-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-slate-900">
                          {m.codigo_animal}
                          <span className="font-normal text-slate-600">
                            {" "}
                            · {m.especie}
                          </span>
                        </p>
                        <p className="truncate text-sm text-slate-500">
                          {m.localidad_puna || "Puna jujeña"}
                        </p>
                        <p className="mt-1.5 flex items-center gap-2 text-sm font-medium text-red-700">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-600" />
                          Le quedan {alerta.horas_restantes.toFixed(1)} h para las 48 h ({m.horas_transcurridas.toFixed(1)} h desde la extracción).
                        </p>
                      </div>
                      <Button
                        asChild
                        className="h-10 shrink-0 bg-emerald-600 px-4 text-sm font-semibold hover:bg-emerald-700"
                      >
                        <Link href={`/ensayos/nuevo?muestra=${m.id_muestra}`}>
                          Analizar
                          <ArrowRight />
                        </Link>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        <section
          aria-label="Muestras en atención"
          className="rounded-xl border border-yellow-300 bg-yellow-50 p-5 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-yellow-900">
            Atención (entre 24 y 40 h)
          </h2>
          <p className="mt-1 text-sm text-yellow-800">
            Muestras pendientes que ya superaron las 24 horas desde la extracción. Conviene programar su análisis hoy.
          </p>

          {cargando ? (
            <Cargando texto="Cargando muestras en atención..." />
          ) : enAtencion.length === 0 ? (
            <p className="mt-3 rounded-md border border-yellow-200 bg-white px-3 py-2 text-sm text-gray-700">
              No hay muestras en ventana de atención en este momento.
            </p>
          ) : (
            <>
              <p className="mt-3 text-sm font-medium text-yellow-900">
                ⚠ {enAtencion.length}{" "}
                {enAtencion.length === 1 ? "muestra en atención" : "muestras en atención"}
              </p>
              <ul className="mt-2 max-h-[21.25rem] space-y-3 overflow-y-auto pr-1">
                {enAtencion.map((m) => (
                  <li
                    key={m.id_muestra}
                    className="flex flex-col gap-3 rounded-xl border border-yellow-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-slate-900">
                        {m.codigo_animal}
                        <span className="font-normal text-slate-600">
                          {" "}
                          · {m.especie}
                        </span>
                      </p>
                      <p className="truncate text-sm text-slate-500">
                        {m.localidad_puna || "Puna jujeña"}
                      </p>
                      <p className="mt-1.5 flex items-center gap-2 text-sm font-medium text-amber-700">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
                        En atención: {m.horas_transcurridas.toFixed(1)} h desde la extracción (quedan {(LIMITE_HORAS - m.horas_transcurridas).toFixed(1)} h para las 48 h).
                      </p>
                    </div>
                    <Button
                      asChild
                      className="h-10 shrink-0 bg-emerald-600 px-4 text-sm font-semibold hover:bg-emerald-700"
                    >
                      <Link href={`/ensayos/nuevo?muestra=${m.id_muestra}`}>
                        Analizar
                        <ArrowRight />
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section
          aria-label="Muestras recientes"
          className="rounded-xl border border-green-300 bg-green-50 p-5 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-green-900">
            Recientes (menos de 24 h)
          </h2>
          <p className="mt-1 text-sm text-green-800">
            Muestras extraídas hace menos de 24 horas, dentro del margen óptimo de procesamiento.
          </p>

          {cargando ? (
            <Cargando texto="Cargando muestras recientes..." />
          ) : recientes.length === 0 ? (
            <p className="mt-3 rounded-md border border-green-200 bg-white px-3 py-2 text-sm text-gray-700">
              No hay muestras recientes pendientes en este momento.
            </p>
          ) : (
            <>
              <p className="mt-3 text-sm font-medium text-green-900">
                ● {recientes.length}{" "}
                {recientes.length === 1 ? "muestra reciente" : "muestras recientes"}
              </p>
              <ul className="mt-2 max-h-[21.25rem] space-y-3 overflow-y-auto pr-1">
                {recientes.map((m) => (
                  <li
                    key={m.id_muestra}
                    className="flex flex-col gap-3 rounded-xl border border-green-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-slate-900">
                        {m.codigo_animal}
                        <span className="font-normal text-slate-600">
                          {" "}
                          · {m.especie}
                        </span>
                      </p>
                      <p className="truncate text-sm text-slate-500">
                        {m.localidad_puna || "Puna jujeña"}
                      </p>
                      <p className="mt-1.5 flex items-center gap-2 text-sm font-medium text-emerald-700">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                        Reciente: {m.horas_transcurridas.toFixed(1)} h desde la extracción (quedan {(LIMITE_HORAS - m.horas_transcurridas).toFixed(1)} h para las 48 h).
                      </p>
                    </div>
                    <Button
                      asChild
                      className="h-10 shrink-0 bg-emerald-600 px-4 text-sm font-semibold hover:bg-emerald-700"
                    >
                      <Link href={`/ensayos/nuevo?muestra=${m.id_muestra}`}>
                        Analizar
                        <ArrowRight />
                      </Link>
                    </Button>
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
