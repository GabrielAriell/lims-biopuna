"use client";

import EditorLimites from "./EditorLimites";
import TablaFracciones from "./TablaFracciones";
import { useAjusteLimites } from "@/hooks/useAjusteLimites";
import type { CalculoLimites, Carril } from "@/lib/tipos";
import type { Especie } from "@/lib/tipos-muestras";

type Props = {
  carril: Carril;
  proteinasTotales: string;
  especie?: Especie | null;
  onAjuste?: (calculo: CalculoLimites | null) => void;
};

export default function ResultadoCarril({ carril, proteinasTotales, especie, onAjuste }: Props) {
  const ajuste = useAjusteLimites(carril, proteinasTotales, onAjuste);
  const calculo = ajuste.calculo;
  const fracciones = calculo?.fracciones ?? carril.fracciones;
  const advertencias = calculo?.advertencias ?? carril.advertencias;
  const relacionAg = calculo ? calculo.relacion_ag : carril.relacion_ag;

  return (
    <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Carril {carril.indice}</h2>
        {ajuste.recalculando && <span className="text-sm text-gray-500">Recalculando…</span>}
      </div>

      {carril.error ? (
        <p className="rounded bg-red-50 p-2 text-sm text-red-800">{carril.error}</p>
      ) : (
        <>
          <EditorLimites
            perfil={carril.perfil}
            cortes={ajuste.cortes}
            nombres={fracciones.map((f) => f.nombre)}
            deshabilitado={ajuste.recalculando}
            hayAjuste={ajuste.ajustado}
            onCambiar={ajuste.cambiar}
            onSoltar={ajuste.aplicar}
            onRestablecer={ajuste.restablecer}
          />
          {ajuste.error && (
            <p className="rounded bg-red-50 p-2 text-sm text-red-800">{ajuste.error}</p>
          )}
          <TablaFracciones fracciones={fracciones} relacionAg={relacionAg} especie={especie} />
        </>
      )}

      {advertencias.map((a) => (
        <p key={a} className="rounded bg-yellow-50 p-2 text-sm text-yellow-800">
          {a}
        </p>
      ))}
    </section>
  );
}
