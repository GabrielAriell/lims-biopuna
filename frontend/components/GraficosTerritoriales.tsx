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
type FiltroConvenio = "todos" | "con" | "sin";
type Agrupacion = "departamento" | "localidad";

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

function ordenar(puntos: Punto[]): Punto[] {
  return puntos.sort(
    (a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, "es"),
  );
}

function etiquetaTorta(props: PieLabelRenderProps): string {
  const nombre = String(props.name ?? "");
  const porcentaje = Math.round((props.percent ?? 0) * 100);
  return `${nombre} ${porcentaje}%`;
}

export default function GraficosTerritoriales({ muestras, campanas }: Props) {
  const [agrupacion, setAgrupacion] = useState<Agrupacion>("departamento");
  const [filtroConvenio, setFiltroConvenio] = useState<FiltroConvenio>("todos");

  const campanasPorId = useMemo(
    () => new Map(campanas.map((c) => [c.id_campana, c])),
    [campanas],
  );

  const muestrasConvenio = useMemo(
    () =>
      muestras.filter((m) => {
        if (filtroConvenio === "todos") return true;
        const esConvenio = Boolean(campanasPorId.get(m.id_campana)?.convenio_inta);
        return filtroConvenio === "con" ? esConvenio : !esConvenio;
      }),
    [muestras, campanasPorId, filtroConvenio],
  );

  const totalesConvenio = useMemo(() => {
    let con = 0;
    for (const m of muestras) {
      if (campanasPorId.get(m.id_campana)?.convenio_inta) con += 1;
    }
    return { con, sin: muestras.length - con, todos: muestras.length };
  }, [muestras, campanasPorId]);

  const porEspecie = useMemo(
    () => ordenar(contar(muestrasConvenio.map((m) => m.especie))),
    [muestrasConvenio],
  );

  const porTerritorio = useMemo(() => {
    const nombres = muestrasConvenio.map((m) => {
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
    return ordenar(contar(nombres));
  }, [muestrasConvenio, campanasPorId, agrupacion]);

  if (muestrasConvenio.length === 0) {
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Análisis territorial (Convenio INTA)</h2>
        <p className="mt-1 text-sm text-gray-500">
          No hay muestras que coincidan con los filtros y el convenio elegido.
        </p>
        <FiltroConvenioUI
          valor={filtroConvenio}
          onChange={setFiltroConvenio}
          totales={totalesConvenio}
        />
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Análisis territorial (Convenio INTA)</h2>
          <p className="text-sm text-gray-600">
            Distribución de las {muestrasConvenio.length} muestras que coinciden con
            los filtros actuales
            {filtroConvenio === "con"
              ? " y con convenio INTA"
              : filtroConvenio === "sin"
                ? " y sin convenio INTA"
                : ""}
            .
          </p>
        </div>
        <FiltroConvenioUI
          valor={filtroConvenio}
          onChange={setFiltroConvenio}
          totales={totalesConvenio}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Agrupar territorio por
        </span>
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
            Departamento
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
            Localidad/paraje
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
            Muestras por{" "}
            {agrupacion === "departamento" ? "departamento" : "localidad/paraje"}
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

function FiltroConvenioUI({
  valor,
  onChange,
  totales,
}: {
  valor: FiltroConvenio;
  onChange: (valor: FiltroConvenio) => void;
  totales: { con: number; sin: number; todos: number };
}) {
  const opciones: Array<{ valor: FiltroConvenio; texto: string }> = [
    { valor: "todos", texto: `Todas (${totales.todos})` },
    { valor: "con", texto: `Con convenio (${totales.con})` },
    { valor: "sin", texto: `Sin convenio (${totales.sin})` },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
        Convenio INTA
      </span>
      <div className="flex gap-1 rounded border border-gray-200 bg-gray-50 p-0.5">
        {opciones.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            onClick={() => onChange(opcion.valor)}
            className={`rounded px-3 py-1 text-sm ${
              valor === opcion.valor
                ? "bg-white font-medium shadow-sm"
                : "text-gray-600"
            }`}
          >
            {opcion.texto}
          </button>
        ))}
      </div>
    </div>
  );
}
