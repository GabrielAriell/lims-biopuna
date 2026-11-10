"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Zona } from "@/lib/tipos";

const COLORES = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#be185d", "#4b5563"];

type Props = {
  perfil: number[];
  zonas: Zona[];
  nombres?: string[];
};

export default function GraficoCarril({ perfil, zonas, nombres = [] }: Props) {
  const datos = perfil.map((y, x) => ({ x, y }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, Math.max(1, datos.length - 1)]}
            tick={{ fontSize: 12 }}
          />
          <YAxis tick={{ fontSize: 12 }} width={48} />
          <Tooltip />
          {zonas.map(([inicio, fin], k) => (
            <ReferenceArea
              key={`${inicio}-${fin}-${k}`}
              x1={inicio}
              x2={fin}
              fill={COLORES[k % COLORES.length]}
              fillOpacity={0.15}
              label={{
                value: nombres[k] ?? `Zona ${k + 1}`,
                position: "insideTop",
                fontSize: 11,
              }}
            />
          ))}
          <Line
            type="monotone"
            dataKey="y"
            stroke="#111827"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
