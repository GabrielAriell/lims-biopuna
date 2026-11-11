import type { Fraccion } from "@/lib/tipos";
import type { Especie } from "@/lib/tipos-muestras";
import { evaluarValor } from "@/lib/rangos-referencia";

const fmt = (v: number, d = 2) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });

type Props = {
  fracciones: Fraccion[];
  relacionAg: number | null;
  especie?: Especie | null;
};

function claseCelda(nivel: "normal" | "alerta" | "critico" | undefined) {
  if (nivel === "critico") return "bg-red-100 text-red-900 font-medium";
  if (nivel === "alerta") return "bg-yellow-100 text-yellow-900 font-medium";
  return "";
}

export default function TablaFracciones({ fracciones, relacionAg, especie }: Props) {
  if (fracciones.length === 0) return null;

  const evalAg = evaluarValor(especie, "A/G", relacionAg);
  const etiquetas = new Set<string>();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-300 text-left">
            <th className="py-2 pr-4">Fracción</th>
            <th className="py-2 pr-4 text-right">%</th>
            <th className="py-2 pr-4 text-right">g/dL</th>
            <th className="py-2 text-right">Área</th>
          </tr>
        </thead>
        <tbody>
          {fracciones.map((f, k) => {
            const ev = evaluarValor(especie, f.nombre, f.concentracion_g_dl);
            if (ev && ev.nivel !== "normal" && ev.etiqueta) etiquetas.add(`${f.nombre}: ${ev.etiqueta}`);
            return (
              <tr key={`${f.nombre}-${k}`} className="border-b border-gray-100">
                <td className="py-2 pr-4">{f.nombre}</td>
                <td className="py-2 pr-4 text-right">{fmt(f.porcentaje)}</td>
                <td
                  className={`py-2 pr-4 text-right ${claseCelda(ev?.nivel)}`}
                  title={ev && ev.nivel !== "normal" ? ev.etiqueta : undefined}
                >
                  {f.concentracion_g_dl === null ? "-" : fmt(f.concentracion_g_dl, 3)}
                </td>
                <td className="py-2 text-right">{fmt(f.area, 1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {relacionAg !== null && (
        <p className={`mt-2 text-sm font-medium ${claseCelda(evalAg?.nivel)} inline-block rounded px-1`}
           title={evalAg && evalAg.nivel !== "normal" ? evalAg.etiqueta : undefined}>
          Relación A/G: {fmt(relacionAg)}
        </p>
      )}
      {(evalAg && evalAg.nivel !== "normal" && evalAg.etiqueta ? etiquetas.add(`A/G: ${evalAg.etiqueta}`) : null, null)}
      {etiquetas.size > 0 && (
        <div className="mt-2 space-y-1">
          {Array.from(etiquetas).map((e) => (
            <p key={e} className="rounded bg-yellow-50 px-2 py-1 text-xs text-yellow-900 border border-yellow-200">
              {e}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
