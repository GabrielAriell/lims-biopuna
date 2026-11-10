"use client";

import Link from "next/link";

import { useSesion } from "./ProveedorSesion";

type Seccion = "muestras" | "ensayos" | "exploracion";

type Props = {
  activa: Seccion;
};

export default function Encabezado({ activa }: Props) {
  const { usuario, salir } = useSesion();
  const soloLectura = usuario?.rol_sistema === "lectura";

  const clase = (esActiva: boolean) =>
    `rounded px-3 py-1.5 text-sm font-medium ${
      esActiva ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
    }`;

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-bold sm:text-2xl">LIMS-BioPuna</h1>
        <p className="text-sm text-gray-600 sm:text-base">
          {soloLectura
            ? "Exploración y consulta de datos (solo lectura)"
            : "Análisis de tiras y trazabilidad de muestras"}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:items-end">
        <nav className="flex flex-wrap gap-2">
          <Link href="/exploracion" className={clase(activa === "exploracion")}>
            Exploración
          </Link>
          <Link href="/muestras" className={clase(activa === "muestras")}>
            Muestras y campañas
          </Link>
          {!soloLectura && (
            <Link href="/ensayos/nuevo" className={clase(activa === "ensayos")}>
              Nuevo ensayo
            </Link>
          )}
        </nav>

        {usuario && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span className="font-medium text-gray-800">{usuario.nombre}</span>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">
              {usuario.rol_sistema}
            </span>
            <button
              type="button"
              onClick={() => void salir()}
              className="rounded border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Salir
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
