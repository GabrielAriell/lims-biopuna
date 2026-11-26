"use client";

import Link from "next/link";
import { useMemo } from "react";

import MarcoDashboard from "@/components/MarcoDashboard";
import ListaCampanas from "@/components/ListaCampanas";
import { useSesion } from "@/components/ProveedorSesion";
import { useMuestras } from "@/hooks/useMuestras";
import { puedeEscribir } from "@/lib/sesion";

export default function PaginaMuestrasCliente() {
  const { usuario } = useSesion();
  const { campanas, muestras, cargando, error, recargar } = useMuestras();
  const habilitadoEscribir = puedeEscribir(usuario);

  const sugerenciasLocalidad = useMemo(() => {
    const valores = campanas
      .map((c) => c.localidad_detalle?.trim())
      .filter((v): v is string => Boolean(v));
    return Array.from(new Set(valores)).sort((a, b) => a.localeCompare(b, "es"));
  }, [campanas]);

  return (
    <MarcoDashboard
      activa="muestras"
      titulo="Campañas y Muestras"
      subtitulo="Salidas a territorio, registro de animales y control del tiempo de análisis (48 hs)."
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 shadow-xs">
            {error}
          </div>
        )}

        {!habilitadoEscribir && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-xs">
            <strong>Modo solo lectura:</strong> podés consultar campañas,
            muestras, reportes y probar el analizador de tiras, pero tu cuenta
            no tiene permiso para crear campañas ni registrar muestras.
          </div>
        )}

        <ListaCampanas
          campanas={campanas}
          muestras={muestras}
          cargando={cargando}
          sugerenciasLocalidad={sugerenciasLocalidad}
          onCambiada={recargar}
        />

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Consultar y exportar datos</h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-600">
              Para buscar animales, ver análisis anteriores o descargar planillas Excel, visitá la sección de Reportes.
            </p>
          </div>
          <Link
            href="/exploracion"
            className="inline-flex w-full shrink-0 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-2xs hover:bg-emerald-700 transition sm:w-auto"
          >
            Ir a Reportes →
          </Link>
        </section>
      </div>
    </MarcoDashboard>
  );
}
