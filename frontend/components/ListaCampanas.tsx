"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, MapPin, Plus } from "lucide-react";

import Cargando from "./Cargando";
import FormularioCampana from "./FormularioCampana";
import type { Campana, Especie, Muestra } from "@/lib/tipos-muestras";

const PLURALES: Record<Especie, string> = {
  Llama: "llamas",
  Vicuña: "vicuñas",
  Oveja: "ovejas",
  Caballo: "caballos",
};

function formatearFecha(iso: string): string {
  const [anio, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${anio}`;
}

function resumenEspecies(muestras: Muestra[]): string {
  const conteo = new Map<Especie, number>();
  for (const m of muestras) {
    conteo.set(m.especie, (conteo.get(m.especie) ?? 0) + 1);
  }
  return [...conteo.entries()]
    .map(([especie, n]) =>
      n === 1 ? `1 ${especie.toLowerCase()}` : `${n} ${PLURALES[especie]}`,
    )
    .join(" · ");
}

// Cuántas muestras piden atención (semáforo amarillo o rojo) en la campaña.
function contarApuradas(muestras: Muestra[]): {
  atencion: number;
  fuera: number;
} {
  let atencion = 0;
  let fuera = 0;
  for (const m of muestras) {
    if (m.estado_48h === "amarillo") atencion += 1;
    else if (m.estado_48h === "rojo") fuera += 1;
  }
  return { atencion, fuera };
}

type Props = {
  campanas: Campana[];
  muestras: Muestra[];
  cargando: boolean;
  sugerenciasLocalidad: string[];
  onCambiada: () => Promise<void> | void;
};

export default function ListaCampanas({
  campanas,
  muestras,
  cargando,
  sugerenciasLocalidad,
  onCambiada,
}: Props) {
  const router = useRouter();
  const [nuevaAbierta, setNuevaAbierta] = useState(false);

  const porCampana = useMemo(() => {
    const grupos = new Map<number, Muestra[]>();
    for (const m of muestras) {
      const lista = grupos.get(m.id_campana) ?? [];
      lista.push(m);
      grupos.set(m.id_campana, lista);
    }
    return grupos;
  }, [muestras]);

  async function campanaCreada(campana: Campana) {
    setNuevaAbierta(false);
    await onCambiada();
    // La salida recién creada se abre sola, lista para cargar sus animales.
    router.push(`/muestras/campana/${campana.id_campana}`);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            Campañas registradas
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Tus salidas a territorio. Tocá una campaña para ver sus animales o
            cargar más muestras.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {campanas.length > 0 && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {campanas.length}{" "}
              {campanas.length === 1 ? "campaña" : "campañas"}
            </span>
          )}
          <button
            type="button"
            onClick={() => setNuevaAbierta((v) => !v)}
            aria-expanded={nuevaAbierta}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-2xs hover:bg-emerald-700"
          >
            <Plus
              className={`h-4 w-4 transition-transform ${nuevaAbierta ? "rotate-45" : ""}`}
            />
            Nueva campaña
          </button>
        </div>
      </div>

      {nuevaAbierta && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <FormularioCampana
            sugerenciasLocalidad={sugerenciasLocalidad}
            onCreada={campanaCreada}
            onCerrar={() => setNuevaAbierta(false)}
          />
        </div>
      )}

      {cargando ? (
        <Cargando texto="Cargando campañas..." />
      ) : campanas.length === 0 ? (
        !nuevaAbierta && (
          <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
            Todavía no hay campañas. Creá la primera con el botón
            &quot;Nueva campaña&quot;.
          </p>
        )
      ) : (
        <ul className="mt-4 max-h-[23rem] space-y-3 overflow-y-auto pr-1">
          {campanas.map((campana) => {
            const susMuestras = porCampana.get(campana.id_campana) ?? [];
            const { atencion, fuera } = contarApuradas(susMuestras);
            return (
              <li key={campana.id_campana}>
                <Link
                  href={`/muestras/campana/${campana.id_campana}`}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <MapPin className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-slate-900">
                      {campana.localidad_puna}
                    </span>
                    <span className="mt-0.5 block text-sm text-slate-500">
                      Salida {formatearFecha(campana.fecha_salida)}
                      {campana.convenio_inta && " · Convenio INTA"}
                      {" · "}
                      {susMuestras.length}{" "}
                      {susMuestras.length === 1 ? "muestra" : "muestras"}
                      {susMuestras.length > 0 &&
                        ` (${resumenEspecies(susMuestras)})`}
                    </span>
                    {(fuera > 0 || atencion > 0) && (
                      <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium">
                        {fuera > 0 && (
                          <span className="inline-flex items-center gap-1.5 text-red-700">
                            <span className="h-2 w-2 rounded-full bg-red-500" />
                            {fuera} fuera de plazo
                          </span>
                        )}
                        {atencion > 0 && (
                          <span className="inline-flex items-center gap-1.5 text-amber-700">
                            <span className="h-2 w-2 rounded-full bg-amber-500" />
                            {atencion} por vencer
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                  <ArrowRight className="h-5 w-5 shrink-0 text-slate-400" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
