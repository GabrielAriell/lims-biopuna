"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";

import { useGuardarEnsayo } from "@/hooks/useGuardarEnsayo";
import { useSesion } from "@/components/ProveedorSesion";
import { puedeEscribir } from "@/lib/sesion";
import {
  dataUrlABlob,
  prepararCarriles,
  proteinasTotalesNumero,
} from "@/lib/ensayos";
import type { AnalisisTira } from "@/lib/tipos";
import type { EnsayoGuardado } from "@/lib/tipos-ensayos";
import type { Muestra } from "@/lib/tipos-muestras";

type Props = {
  analisis: AnalisisTira;
  proteinasTotales: string;
  onProteinas: (valor: string) => void;
  muestra: Muestra | null;
  muestraFueraDePlazo: boolean;
  onGuardado: (ensayo: EnsayoGuardado) => void;
  onVolver: () => void;
  onDescargar: () => void;
  onElegirMuestra: () => void;
};

const fmt = (v: number, d = 2) =>
  v.toLocaleString("es-AR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });

export default function PasoResultado({
  analisis,
  proteinasTotales,
  onProteinas,
  muestra,
  muestraFueraDePlazo,
  onGuardado,
  onVolver,
  onDescargar,
  onElegirMuestra,
}: Props) {
  const { usuario } = useSesion();
  const { guardar, guardando, error } = useGuardarEnsayo();
  const [errorImagen, setErrorImagen] = useState<string | null>(null);

  const carril = analisis.carriles[0];
  const { carriles, problemas } = useMemo(
    () => prepararCarriles(analisis),
    [analisis],
  );
  const proteinas = proteinasTotalesNumero(proteinasTotales);
  const tienePermisoEscritura = puedeEscribir(usuario);
  const listo =
    carriles.length > 0 &&
    problemas.length === 0 &&
    proteinas !== null &&
    tienePermisoEscritura;

  async function enviar() {
    if (!listo || proteinas === null) return;
    if (muestraFueraDePlazo) {
      const confirmar = window.confirm(
        "Esta muestra está fuera de plazo (superó las 48 h). ¿Deseás guardar el ensayo igualmente para mantener la trazabilidad?",
      );
      if (!confirmar) return;
    }
    setErrorImagen(null);
    try {
      const imagen = await dataUrlABlob(analisis.imagen);
      const ensayo = await guardar(
        {
          id_muestra: muestra!.id_muestra,
          proteinas_totales: proteinas,
          carriles,
        },
        imagen,
      );
      if (ensayo) onGuardado(ensayo);
    } catch (e) {
      setErrorImagen(
        e instanceof Error ? e.message : "No se pudo preparar la imagen",
      );
    }
  }

  // ---- Resultado normal ----
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          {muestra ? `Resultado de ${muestra.codigo_animal}` : "Resultado"}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Revisá los valores antes de {muestra ? "guardar" : "descargar"}.
        </p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-900">
            Relación Albúmina / Globulinas
          </p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-emerald-800">
            {carril?.relacion_ag != null ? fmt(carril.relacion_ag) : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-700">
            Proteínas totales
          </p>
          {proteinas !== null ? (
            <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              {fmt(proteinas)}{" "}
              <span className="text-base font-semibold text-slate-500">
                g/dL
              </span>
            </p>
          ) : (
            <div className="mt-1.5">
              <input
                type="text"
                inputMode="decimal"
                placeholder="Ej: 6,5"
                value={proteinasTotales}
                onChange={(e) => onProteinas(e.target.value)}
                className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-lg font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <p className="mt-1 text-xs text-amber-700">
                Falta para mostrar g/dL y guardar
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Fracciones */}
      {carril && carril.fracciones.length > 0 && (
        <ul className="divide-y divide-slate-100 border-y border-slate-100">
          {carril.fracciones.map((f, i) => (
            <li
              key={`${i}-${f.nombre}`}
              className="flex items-center justify-between gap-3 py-3"
            >
              <span className="text-[15px] text-slate-800">{f.nombre}</span>
              <span className="text-right text-[15px] font-semibold tabular-nums text-slate-900">
                {fmt(f.porcentaje, 1)}%
                <span className="font-normal text-slate-500">
                  {f.concentracion_g_dl != null
                    ? ` · ${fmt(f.concentracion_g_dl)} g/dL`
                    : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {carril?.error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {carril.error}
        </p>
      )}

      {[...analisis.advertencias, ...(carril?.advertencias ?? [])].map((a) => (
        <p
          key={a}
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
        >
          {a}
        </p>
      ))}

      {muestraFueraDePlazo && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <strong>Muestra fuera de plazo:</strong> superó las 48 h. Al guardar
          se pedirá confirmación para registrar el ensayo igualmente y mantener
          la trazabilidad.
        </p>
      )}

      {!muestra && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <strong>Análisis libre:</strong> podés descargar la planilla, pero no
          se guarda nada en el sistema. Para guardar el resultado, volvé al
          paso 1 y elegí una muestra.
        </p>
      )}

      {problemas.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-medium">No se puede guardar todavía:</p>
          <ul className="mt-1 list-disc pl-5">
            {problemas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {usuario && !tienePermisoEscritura && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Modo solo lectura:</strong> podés analizar tiras y ajustar
          fracciones para probar el sistema, pero tu cuenta no tiene permiso
          para guardar ensayos.
        </p>
      )}

      {(error || errorImagen) && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error ?? errorImagen}
        </p>
      )}

      {/* Acciones */}
      <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-4 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onVolver}
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
        >
          ← Volver
        </button>
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          {!muestra && (
            <button
              type="button"
              onClick={onElegirMuestra}
              className="w-full rounded-lg border border-emerald-600 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 sm:w-auto"
            >
              Elegir muestra
            </button>
          )}
          <button
            type="button"
            onClick={onDescargar}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
          >
            <Download className="h-4 w-4" />
            Descargar planilla
          </button>
          {muestra && (
            <button
              type="button"
              onClick={enviar}
              disabled={!listo || guardando}
              className="w-full rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {guardando ? "Guardando..." : "Guardar resultado"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
