"use client";

import { Check } from "lucide-react";

export type PasoDef = {
  numero: number;
  titulo: string;
};

const PASOS: PasoDef[] = [
  { numero: 1, titulo: "Elegir muestra" },
  { numero: 2, titulo: "Cargar foto" },
  { numero: 3, titulo: "Revisar bandas" },
  { numero: 4, titulo: "Resultado" },
];

type Props = {
  paso: number;
  // Pasos ya completados: se puede volver a ellos tocando el título.
  onIrA?: (paso: number) => void;
};

export default function PasosProgreso({ paso, onIrA }: Props) {
  const actual = PASOS[paso - 1];
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-900">
        Paso {paso} de {PASOS.length}
        <span className="font-normal text-slate-600 sm:hidden">
          {" "}
          · {actual.titulo}
        </span>
      </p>

      {/* Barra segmentada */}
      <div className="grid grid-cols-4 gap-2" aria-hidden="true">
        {PASOS.map((p) => (
          <div
            key={p.numero}
            className={`h-2 rounded-full ${
              p.numero <= paso ? "bg-emerald-600" : "bg-slate-200"
            }`}
          />
        ))}
      </div>

      {/* Etiquetas */}
      <ol className="grid grid-cols-4 gap-2">
        {PASOS.map((p) => {
          const completado = p.numero < paso;
          const esActual = p.numero === paso;
          const etiqueta = (
            <>
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  completado
                    ? "bg-emerald-600 text-white"
                    : esActual
                      ? "border-2 border-emerald-600 bg-white text-emerald-700"
                      : "bg-slate-200 text-slate-500"
                }`}
              >
                {completado ? <Check className="h-3.5 w-3.5" /> : p.numero}
              </span>
              <span
                className={`hidden truncate text-sm sm:inline ${
                  esActual
                    ? "font-semibold text-slate-900"
                    : completado
                      ? "font-medium text-emerald-800"
                      : "text-slate-500"
                }`}
              >
                {p.titulo}
              </span>
            </>
          );
          return (
            <li
              key={p.numero}
              aria-current={esActual ? "step" : undefined}
              className="min-w-0"
            >
              {completado && onIrA ? (
                <button
                  type="button"
                  onClick={() => onIrA(p.numero)}
                  className="flex min-w-0 items-center justify-center gap-2 rounded text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 sm:justify-start"
                >
                  {etiqueta}
                </button>
              ) : (
                <span className="flex min-w-0 items-center justify-center gap-2 sm:justify-start">
                  {etiqueta}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
