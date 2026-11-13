"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import MarcoDashboard from "@/components/MarcoDashboard";
import FormularioCampana from "@/components/FormularioCampana";
import FormularioMuestra from "@/components/FormularioMuestra";
import { useMuestras } from "@/hooks/useMuestras";

export default function PaginaMuestrasCliente() {
  const { campanas, error, recargar } = useMuestras();
  const [campanaReciente, setCampanaReciente] = useState<number | null>(null);

  const sugerenciasLocalidad = useMemo(() => {
    const valores = campanas
      .map((c) => c.localidad_detalle?.trim())
      .filter((v): v is string => Boolean(v));
    return Array.from(new Set(valores)).sort((a, b) => a.localeCompare(b, "es"));
  }, [campanas]);

  return (
    <MarcoDashboard
      activa="muestras"
      titulo="Muestras y Campañas"
      subtitulo="Carga de campañas en la Puna, registro de animales y control del tiempo de análisis (48 hs)."
    >
      <div className="space-y-6 max-w-7xl">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 shadow-xs">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <FormularioCampana
            sugerenciasLocalidad={sugerenciasLocalidad}
            onCreada={async (campana) => {
              setCampanaReciente(campana.id_campana);
              await recargar();
            }}
          />
          <FormularioMuestra
            key={campanaReciente ?? "sin-campana"}
            campanas={campanas}
            idCampanaInicial={campanaReciente}
            onCreada={recargar}
          />
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Consultar y exportar datos</h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-600">
              Para buscar animales, ver análisis anteriores o descargar planillas Excel, visitá la sección de Reportes.
            </p>
          </div>
          <Link
            href="/exploracion"
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-2xs hover:bg-emerald-700 transition"
          >
            Ir a Reportes →
          </Link>
        </section>
      </div>
    </MarcoDashboard>
  );
}
