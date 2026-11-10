import type { Fraccion } from "@/lib/tipos";

const fmt = (v: number, d = 2) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });

type Props = {
  fracciones: Fraccion[];
  relacionAg: number | null;
};

export default function TablaFracciones({ fracciones, relacionAg }: Props) {
  if (fracciones.length === 0) return null;

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
          {fracciones.map((f, k) => (
            <tr key={`${f.nombre}-${k}`} className="border-b border-gray-100">
              <td className="py-2 pr-4">{f.nombre}</td>
              <td className="py-2 pr-4 text-right">{fmt(f.porcentaje)}</td>
              <td className="py-2 pr-4 text-right">
                {f.concentracion_g_dl === null ? "-" : fmt(f.concentracion_g_dl, 3)}
              </td>
              <td className="py-2 text-right">{fmt(f.area, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {relacionAg !== null && (
        <p className="mt-2 text-sm font-medium">Relación A/G: {fmt(relacionAg)}</p>
      )}
    </div>
  );
}
