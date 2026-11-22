import type { Fraccion } from "@/lib/tipos";
import type { Especie } from "@/lib/tipos-muestras";
import { esNombreAlbumina, evaluarValor } from "@/lib/rangos-referencia";

const fmt = (v: number, d = 2) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });

type CampoEditable = "nombre" | "porcentaje" | "concentracion_g_dl";

type Props = {
  fracciones: Fraccion[];
  relacionAg: number | null;
  especie?: Especie | null;
  editadas?: boolean[];
  onEditar?: (indice: number, campo: CampoEditable, valor: string) => void;
  deshabilitado?: boolean;
};

const INPUT =
  "w-full min-w-0 rounded border border-gray-300 px-2 py-1.5 text-sm";

function claseCelda(nivel: "normal" | "alerta" | "critico" | undefined) {
  if (nivel === "critico") return "bg-red-100 text-red-900 font-medium";
  if (nivel === "alerta") return "bg-yellow-100 text-yellow-900 font-medium";
  return "";
}

export default function TablaFracciones({
  fracciones,
  relacionAg,
  especie,
  editadas,
  onEditar,
  deshabilitado,
}: Props) {
  if (fracciones.length === 0) return null;

  const editable = Boolean(onEditar) && !deshabilitado;
  const evalAg = evaluarValor(especie, "A/G", relacionAg);
  const etiquetas = new Set<string>();

  // Si ninguna fracción se llama Albúmina, se toma la de mayor g/dL (o %)
  // como candidata para aplicar rangos de Albúmina con nombres genéricos.
  let idxAlbumina: number | null = null;
  const idxNombrada = fracciones.findIndex((f) => esNombreAlbumina(f.nombre));
  if (idxNombrada >= 0) idxAlbumina = idxNombrada;
  else {
    let mejor = -1;
    fracciones.forEach((f, i) => {
      const v = f.concentracion_g_dl ?? f.porcentaje ?? f.area;
      if (v != null && Number.isFinite(v) && v > mejor) {
        mejor = v;
        idxAlbumina = i;
      }
    });
  }

  const filas = fracciones.map((f, k) => {
    const ev = evaluarValor(especie, f.nombre, f.concentracion_g_dl);
    const evAlbumina =
      !ev && k === idxAlbumina
        ? evaluarValor(especie, "Albúmina", f.concentracion_g_dl)
        : null;
    const evFinal = ev ?? evAlbumina;
    const etiquetaParam = ev ? f.nombre : evAlbumina ? "Albúmina" : f.nombre;
    if (evFinal && evFinal.nivel !== "normal" && evFinal.etiqueta) {
      etiquetas.add(`${etiquetaParam}: ${evFinal.etiqueta}`);
    }
    return { f, k, evFinal, editada: Boolean(editadas?.[k]) };
  });

  if (evalAg && evalAg.nivel !== "normal" && evalAg.etiqueta) {
    etiquetas.add(`A/G: ${evalAg.etiqueta}`);
  }

  return (
    <div className="space-y-2">
      {editable && (
        <p className="text-xs text-gray-500">
          Podés editar el nombre, % y g/dL. El área y la relación A/G se calculan
          automáticamente.
        </p>
      )}

      {/* Móvil: una tarjeta por fracción, sin scroll horizontal */}
      <div className="space-y-3 sm:hidden">
        <p className="text-sm font-semibold text-slate-900">Fracción</p>
        {filas.map(({ f, k, evFinal, editada }) => (
          <div
            key={`${k}-${f.inicio}-${f.fin}`}
            className={`grid grid-cols-2 gap-2 rounded-lg border border-gray-200 p-3 ${
              editable ? "" : "items-center"
            }`}
          >
            <div className="col-span-2">
              {editable ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={f.nombre}
                    onChange={(e) => onEditar?.(k, "nombre", e.target.value)}
                    className={INPUT}
                  />
                  {editada && (
                    <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                      editado
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-sm font-medium">{f.nombre}</span>
              )}
            </div>
            <label className="block text-xs text-gray-500">
              %
              {editable ? (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={Number.isFinite(f.porcentaje) ? f.porcentaje : ""}
                  onChange={(e) => onEditar?.(k, "porcentaje", e.target.value)}
                  className={`${INPUT} mt-1 text-right`}
                />
              ) : (
                <span className="mt-1 block text-sm">{fmt(f.porcentaje)}</span>
              )}
            </label>
            <label
              className={`block text-xs text-gray-500 ${editable ? "" : claseCelda(evFinal?.nivel)}`}
              title={
                evFinal && evFinal.nivel !== "normal" ? evFinal.etiqueta : undefined
              }
            >
              g/dL
              {editable ? (
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  max="20"
                  value={f.concentracion_g_dl ?? ""}
                  onChange={(e) =>
                    onEditar?.(k, "concentracion_g_dl", e.target.value)
                  }
                  className={`${INPUT} mt-1 text-right`}
                />
              ) : (
                <span className="mt-1 block text-sm">
                  {f.concentracion_g_dl === null
                    ? "-"
                    : fmt(f.concentracion_g_dl, 3)}
                </span>
              )}
            </label>
            <p className="col-span-2 text-xs text-gray-500">
              Área: <span className="text-sm text-gray-700">{fmt(f.area, 1)}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Pantallas medianas+: tabla tradicional */}
      <div className="hidden overflow-x-auto sm:block">
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
            {filas.map(({ f, k, evFinal, editada }) => (
              <tr key={`${k}-${f.inicio}-${f.fin}`} className="border-b border-gray-100">
                <td className="py-2 pr-4">
                  {editable ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={f.nombre}
                        onChange={(e) => onEditar?.(k, "nombre", e.target.value)}
                        className="w-full min-w-[7rem] rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                      {editada && (
                        <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                          editado
                        </span>
                      )}
                    </div>
                  ) : (
                    f.nombre
                  )}
                </td>
                <td className="py-2 pr-4 text-right">
                  {editable ? (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={Number.isFinite(f.porcentaje) ? f.porcentaje : ""}
                      onChange={(e) => onEditar?.(k, "porcentaje", e.target.value)}
                      className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm"
                    />
                  ) : (
                    fmt(f.porcentaje)
                  )}
                </td>
                <td
                  className={`py-2 pr-4 text-right ${claseCelda(evFinal?.nivel)}`}
                  title={
                    evFinal && evFinal.nivel !== "normal" ? evFinal.etiqueta : undefined
                  }
                >
                  {editable ? (
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      max="20"
                      value={f.concentracion_g_dl ?? ""}
                      onChange={(e) => onEditar?.(k, "concentracion_g_dl", e.target.value)}
                      className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm"
                    />
                  ) : f.concentracion_g_dl === null ? (
                    "-"
                  ) : (
                    fmt(f.concentracion_g_dl, 3)
                  )}
                </td>
                <td className="py-2 text-right text-gray-600">{fmt(f.area, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {relacionAg !== null && (
        <p
          className={`mt-2 inline-block rounded px-1 text-sm font-medium ${claseCelda(evalAg?.nivel)}`}
          title={evalAg && evalAg.nivel !== "normal" ? evalAg.etiqueta : undefined}
        >
          Relación A/G: {fmt(relacionAg)}{" "}
          <span className="font-normal text-gray-500">(automática)</span>
        </p>
      )}
      {etiquetas.size > 0 && (
        <div className="mt-2 space-y-1">
          {Array.from(etiquetas).map((e) => (
            <p
              key={e}
              className="rounded border border-yellow-200 bg-yellow-50 px-2 py-1 text-xs text-yellow-900"
            >
              {e}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
