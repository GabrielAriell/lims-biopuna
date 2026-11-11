"use client";

import Image from "next/image";
import Link from "next/link";

import { useSesion } from "./ProveedorSesion";

type Seccion = "inicio" | "muestras" | "ensayos" | "exploracion" | "prioridades";

type Props = {
  activa?: Seccion;
};

export default function Encabezado({ activa }: Props) {
  const { usuario, salir } = useSesion();

  const clase = (esActiva: boolean) =>
    `rounded px-3 py-1.5 text-sm font-medium ${
      esActiva ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
    }`;

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="min-w-0">
        <Link href="/" className="inline-flex items-center gap-2 hover:opacity-90">
          <Image
            src="/logo-camelia.png"
            alt="Camelia Biotech"
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
            priority
          />
          <span className="text-xl font-bold text-gray-900 sm:text-2xl">
            Camelia Biotech
          </span>
        </Link>
      </div>

      <div className="flex flex-col gap-2 sm:items-end">
        <nav className="flex flex-wrap gap-2">
          <Link href="/exploracion" className={clase(activa === "exploracion")}>
            Exploración
          </Link>
          <Link href="/muestras" className={clase(activa === "muestras")}>
            Muestras y campañas
          </Link>
          <Link href="/prioridades" className={clase(activa === "prioridades")}>
            Prioridades
          </Link>
          <Link href="/ensayos/nuevo" className={clase(activa === "ensayos")}>
            Nuevo ensayo
          </Link>
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
