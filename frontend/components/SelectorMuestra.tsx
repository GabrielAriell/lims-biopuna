"use client";

import { useMemo, useState } from "react";

import Semaforo from "./Semaforo";
import type { Muestra } from "@/lib/tipos-muestras";

type Props = {
  muestras: Muestra[];
  cargando: boolean;
  error: string | null;
  seleccionada: number | null;
  onElegir: (muestra: Muestra) => void;
  onDeseleccionar: () => void;
};

const CAMPO =
  "w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900";

export default function SelectorMuestra({
  muestras,
  cargando,
  error,
  seleccionada,
  onElegir,
  onDeseleccionar,
}: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [ocultarProcesadas, setOcultarProcesadas] = useState(false);

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return muestras.filter((muestra) => {
      if (ocultarProcesadas && muestra.estado_48h === "procesada") {
        return false;
      }
      if (!texto) return true;
      return [muestra.codigo_animal, muestra.especie, muestra.localidad_puna]
        .join(" ")
        .toLowerCase()
        .includes(texto);
    });
  }, [muestras, busqueda, ocultarProcesadas]);

  return (
    <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">1. Elegí la muestra</h2>
          <p className="text-sm text-gray-500">
            Buscá por código de animal, especie o localidad. La muestra no se
            modifica: se le agrega un ensayo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {seleccionada !== null && (
            <button
              type="button"
              onClick={onDeseleccionar}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Quitar selección
            </button>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={ocultarProcesadas}
              onChange={(e) => setOcultarProcesadas(e.target.checked)}
            />
            Ocultar procesadas
          </label>
        </div>
      </div>

      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por código, especie o localidad..."
        className={CAMPO}
      />

      {error && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {cargando ? (
        <p className="text-sm text-gray-500">Cargando muestras...</p>
      ) : visibles.length === 0 ? (
        <p className="rounded border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
          No hay muestras que coincidan con la búsqueda.
        </p>
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {visibles.map((muestra) => {
            const activa = muestra.id_muestra === seleccionada;
            return (
              <button
                key={muestra.id_muestra}
                type="button"
                onClick={() => onElegir(muestra)}
                className={`flex w-full flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 text-left text-sm ${
                  activa
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <span className="min-w-0">
                  <span className="font-medium">{muestra.codigo_animal}</span>
                  <span className="text-gray-500">
                    {" "}
                    · {muestra.especie} · {muestra.localidad_puna}
                  </span>
                  <span className="block text-xs text-gray-500">
                    Extraída{" "}
                    {new Date(muestra.fecha_hora_extraccion).toLocaleString(
                      "es-AR",
                      { dateStyle: "short", timeStyle: "short" },
                    )}{" "}
                    · {muestra.horas_transcurridas.toFixed(1)} h
                  </span>
                </span>
                <Semaforo estado={muestra.estado_48h} />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
