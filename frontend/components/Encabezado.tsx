"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

import { construirAlertasCriticas } from "@/lib/alertas";
import { useMuestras } from "@/hooks/useMuestras";
import { useSesion } from "./ProveedorSesion";

type Seccion = "inicio" | "muestras" | "ensayos" | "exploracion" | "prioridades";

type Props = {
  activa?: Seccion;
};

export default function Encabezado({ activa }: Props) {
  const { usuario, salir } = useSesion();
  const { muestras } = useMuestras();
  const criticas = useMemo(() => construirAlertasCriticas(muestras).length, [muestras]);

  const baseItem =
    "inline-flex items-center border-b-[3px] px-4 py-3 text-base font-medium transition-colors";
  const inactivo =
    "border-transparent text-gray-700 hover:border-emerald-400 hover:bg-emerald-100/70 hover:text-emerald-800";
  const activo = "border-emerald-600 bg-emerald-100 font-semibold text-emerald-900";

  const clase = (esActiva: boolean) => `${baseItem} ${esActiva ? activo : inactivo}`;

  const clasePrioridades = () => {
    if (activa === "prioridades") {
      return criticas > 0
        ? `${baseItem} border-red-600 bg-red-50 text-red-800`
        : `${baseItem} ${activo}`;
    }
    if (criticas > 0) {
      return `${baseItem} border-transparent text-red-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800`;
    }
    return `${baseItem} ${inactivo}`;
  };

  return (
    <header className="flex flex-col gap-3 border-b-2 border-emerald-200 bg-emerald-50/40 px-1 pb-0 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="min-w-0 pb-2">
        <Link href="/" className="inline-flex items-center gap-2 hover:opacity-90">
          <Image
            src="/logo-camelia.png"
            alt="Camelia Biotech"
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
            priority
          />
          <span className="text-xl font-bold text-emerald-900 sm:text-2xl">
            Camelia Biotech
          </span>
        </Link>
      </div>

      <div className="flex flex-col gap-2 sm:items-end">
        <nav className="flex flex-wrap gap-x-1 gap-y-0">
          <Link href="/exploracion" className={clase(activa === "exploracion")}>
            Exploración
          </Link>
          <Link href="/muestras" className={clase(activa === "muestras")}>
            Muestras y campañas
          </Link>
          <Link href="/prioridades" className={clasePrioridades()}>
            Prioridades
            {criticas > 0 && (
              <span className="ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-semibold leading-none text-white">
                {criticas}
              </span>
            )}
          </Link>
          <Link href="/ensayos/nuevo" className={clase(activa === "ensayos")}>
            Nuevo ensayo
          </Link>
        </nav>

        {usuario && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span className="font-medium text-gray-800">{usuario.nombre}</span>
            <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
              {usuario.rol_sistema}
            </span>
            <button
              type="button"
              onClick={() => void salir()}
              className="rounded border border-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-800 transition-colors hover:bg-emerald-50"
            >
              Salir
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
