"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PieLabelRenderProps } from "recharts";

import type { Campana, Muestra } from "@/lib/tipos-muestras";

// Colores editables del gráfico de especies.
const COLORES_ESPECIE: Record<string, string> = {
  Llama: "#2563eb",
  Vicuña: "#16a34a",
  Ovino: "#d97706",
};

// Paleta para departamentos/localidades (se repite si hay más categorías).
const PALETA = [
  "#1d4ed8",
  "#0891b2",
  "#16a34a",
  "#ca8a04",
  "#dc2626",
  "#7c3aed",
  "#db2777",
  "#4b5563",
  "#0d9488",
  "#ea580c",
];

type Punto = { nombre: string; cantidad: number };

type Props = {
  /** Muestras ya filtradas en la vista de exploración. */
  muestras: Muestra[];
  campanas: Campana[];
};

function contar(nombres: string[]): Punto[] {
  const mapa = new Map<string, number>();
  for (const nombre of nombres) {
    const clave = nombre.trim() || "Sin dato";
    mapa.set(clave, (mapa.get(clave) ?? 0) + 1);
  }
  return Array.from(mapa, ([nombre, cantidad]) => ({ nombre, cantidad }));
}

function etiquetaTorta(props: PieLabelRenderProps): string {
  const nombre = String(props.name ?? "");
  const porcentaje = Math.round((props.percent ?? 0) * 100);
  return `${nombre} ${porcentaje}%`;
}

export default function GraficosTerritoriales({ muestras, campanas }: Props) {
  const [agrupacion, setAgrupacion] = useState<"departamento" | "localidad">(
    "departamento",
  );

  const campanasPorId = useMemo(
    () => new Map(campanas.map((c) => [c.id_campana, c])),
    [campanas],
  );

  const porEspecie = useMemo(
    () =>
      contar(muestras.map((m) => m.especie)).sort(
        (a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, "es"),
      ),
    [muestras],
  );

  const porTerritorio = useMemo(() => {
    const nombres = muestras.map((m) => {
      const campana = campanasPorId.get(m.id_campana);
      if (agrupacion === "departamento") {
        return campana?.departamento?.trim() || "Sin departamento";
      }
      return (
        campana?.localidad_detalle?.trim() ||
        m.localidad_puna?.split(" · ")[0]?.trim() ||
        "Sin localidad"
      );
    });
    return contar(nombres).sort(
      (a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, "es"),
    );
  }, [muestras, campanasPorId, agrupacion]);

  if (muestras.length === 0) {
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Análisis territorial (Convenio INTA)</h2>
        <p className="mt-1 text-sm text-gray-500">
          No hay muestras que coincidan con los filtros para graficar.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Análisis territorial (Convenio INTA)</h2>
          <p className="text-sm text-gray-600">
            Distribución de las {muestras.length} muestras que coinciden con los
            filtros actuales.
          </p>
        </div>
        <div className="flex gap-1 rounded border border-gray-200 bg-gray-50 p-0.5">
          <button
            type="button"
            onClick={() => setAgrupacion("departamento")}
            className={`rounded px-3 py-1 text-sm ${
              agrupacion === "departamento"
                ? "bg-white font-medium shadow-sm"
                : "text-gray-600"
            }`}
          >
            Por departamento
          </button>
          <button
            type="button"
            onClick={() => setAgrupacion("localidad")}
            className={`rounded px-3 py-1 text-sm ${
              agrupacion === "localidad"
                ? "bg-white font-medium shadow-sm"
                : "text-gray-600"
            }`}
          >
            Por localidad/paraje
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-gray-700">Muestras por especie</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={porEspecie}
                  dataKey="cantidad"
                  nameKey="nombre"
                  name="Muestras"
                  cx="50%"
                  cy="50%"
                  outerRadius="75%"
                  label={etiquetaTorta}
                  labelLine={false}
                >
                  {porEspecie.map((punto, indice) => (
                    <Cell
                      key={punto.nombre}
                      fill={
                        COLORES_ESPECIE[punto.nombre] ??
                        PALETA[indice % PALETA.length]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700">
            Muestras por {agrupacion === "departamento" ? "departamento" : "localidad/paraje"}
          </h3>
          <div
            className="w-full"
            style={{ height: Math.max(288, porTerritorio.length * 34) }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={porTerritorio}
                layout="vertical"
                margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="nombre"
                  width={140}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip />
                <Bar dataKey="cantidad" name="Muestras" radius={[0, 4, 4, 0]}>
                  {porTerritorio.map((punto, indice) => (
                    <Cell
                      key={punto.nombre}
                      fill={PALETA[indice % PALETA.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}
