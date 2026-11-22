"use client";

import Link from "next/link";
import { Check } from "lucide-react";

import type { EnsayoGuardado } from "@/lib/tipos-ensayos";
import type { Muestra } from "@/lib/tipos-muestras";

type Props = {
  ensayo: EnsayoGuardado;
  muestra: Muestra | null;
  onOtraTira: () => void;
};

const fmt = (v: number, d = 2) =>
  v.toLocaleString("es-AR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });

export default function ExitoGuardado({ ensayo, muestra, onOtraTira }: Props) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
            <Check className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-emerald-950">
              Ensayo #{ensayo.id_ensayo} guardado correctamente
            </h2>
            <p className="mt-1 text-sm text-emerald-900">
              {muestra?.codigo_animal ?? `Muestra #${ensayo.id_muestra}`}
              {muestra ? ` · ${muestra.especie}` : ""} — la muestra pasó a
              &quot;procesada&quot;.
            </p>
          </div>
        </div>

        <dl className="mt-4 grid gap-2 text-sm text-emerald-950 sm:grid-cols-2">
          <div>
            <dt className="font-medium">Proteínas totales</dt>
            <dd>{fmt(ensayo.proteinas_totales_g_dl)} g/dL</dd>
          </div>
          <div>
            <dt className="font-medium">Fracciones guardadas</dt>
            <dd>{ensayo.fracciones.length}</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-4 sm:flex-row">
        <button
          type="button"
          onClick={onOtraTira}
          className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 sm:w-auto"
        >
          Analizar otra tira
        </button>
        <Link
          href="/muestras"
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
        >
          Volver a muestras
        </Link>
        {ensayo.url_imagen_tira && (
          <a
            href={ensayo.url_imagen_tira}
            target="_blank"
            rel="noreferrer"
            className="self-center text-sm font-semibold text-emerald-700 hover:underline"
          >
            Ver imagen guardada
          </a>
        )}
      </div>
    </div>
  );
}
