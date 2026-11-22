"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import Cargando from "./Cargando";
import Semaforo from "./Semaforo";
import type { Muestra } from "@/lib/tipos-muestras";

type Props = {
  muestras: Muestra[];
  cargando: boolean;
  error: string | null;
  seleccionada: number | null;
  onElegir: (muestra: Muestra | null) => void;
};

const CAMPO =
  "w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30";

function formatearExtraccion(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(fecha);
}

function lineaMuestra(muestra: Muestra): string {
  return [muestra.codigo_animal, muestra.especie, muestra.localidad_puna]
    .filter((p): p is string => Boolean(p))
    .join(" · ");
}

export default function PasoMuestra({
  muestras,
  cargando,
  error,
  seleccionada,
  onElegir,
}: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [ocultarProcesadas, setOcultarProcesadas] = useState(false);

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return muestras.filter((muestra) => {
      if (ocultarProcesadas && muestra.estado_48h === "procesada") return false;
      if (!texto) return true;
      return [muestra.codigo_animal, muestra.especie, muestra.localidad_puna]
        .join(" ")
        .toLowerCase()
        .includes(texto);
    });
  }, [muestras, busqueda, ocultarProcesadas]);

  const sinMuestra = seleccionada === null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Elegí la muestra
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Buscá por código de animal, especie o localidad. La muestra no se
          modifica: se le agrega un ensayo.
        </p>
      </div>

      {seleccionada !== null && (
        <button
          type="button"
          onClick={() => onElegir(null)}
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
        >
          Quitar selección
        </button>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {cargando ? (
        <Cargando texto="Cargando muestras..." />
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={ocultarProcesadas}
              onChange={(e) => setOcultarProcesadas(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
            />
            Ocultar procesadas
          </label>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por código, especie o localidad"
              className={CAMPO}
            />
          </div>

          <div className="max-h-96 space-y-2.5 overflow-y-auto pr-1">
            {visibles.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
                No hay muestras que coincidan con la búsqueda.
              </p>
            ) : (
              visibles.map((muestra) => {
                const activa = muestra.id_muestra === seleccionada;
                const fueraDePlazo =
                  muestra.estado_48h !== "procesada" &&
                  muestra.horas_transcurridas > 48;
                const extraccion = formatearExtraccion(
                  muestra.fecha_hora_extraccion,
                );
                return (
                  <button
                    key={muestra.id_muestra}
                    type="button"
                    onClick={() => onElegir(muestra)}
                    aria-pressed={activa}
                    className={`block w-full rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                      activa
                        ? "border-emerald-600 bg-emerald-50"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className="block text-[15px] font-semibold text-slate-900">
                      {lineaMuestra(muestra)}
                    </span>
                    <span className="mt-0.5 block text-sm text-slate-500">
                      {extraccion && `Extraída ${extraccion} · `}
                      {muestra.horas_transcurridas.toFixed(1)} h
                    </span>
                    <span className="mt-2 block">
                      <Semaforo estado={muestra.estado_48h} />
                    </span>
                    {activa && fueraDePlazo && (
                      <span className="mt-2 block rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                        Fuera de plazo: se pedirá confirmación antes de guardar,
                        para mantener la trazabilidad.
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Análisis libre, sin muestra */}
      <button
        type="button"
        onClick={() => onElegir(null)}
        aria-pressed={sinMuestra}
        className={`block w-full rounded-xl border border-dashed p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
          sinMuestra
            ? "border-emerald-600 bg-emerald-50"
            : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50"
        }`}
      >
        <span className="block text-[15px] font-semibold text-slate-900">
          Solo quiero probar una tira, sin guardar
        </span>
        <span className="mt-0.5 block text-sm text-slate-500">
          El resultado se muestra y se puede descargar, pero no queda
          registrado.
        </span>
      </button>
    </div>
  );
}
