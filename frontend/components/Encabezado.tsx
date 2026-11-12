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

function IconoPerfil() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-300 text-gray-600">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

export default function Encabezado({ activa }: Props) {
  const { usuario, salir } = useSesion();
  const { muestras } = useMuestras();
  const criticas = useMemo(() => construirAlertasCriticas(muestras).length, [muestras]);

  const baseEnlace =
    "inline-flex items-center whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:py-3 sm:text-base";
  const enlaceInactivo =
    "border-transparent text-emerald-50 hover:border-emerald-200 hover:bg-emerald-500/40 hover:text-white";
  const enlaceActivo =
    "border-white bg-emerald-500/40 text-white";

  const claseEnlace = (esActiva: boolean) =>
    `${baseEnlace} ${esActiva ? enlaceActivo : enlaceInactivo}`;

  return (
    <header className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 border-b border-emerald-700/30 bg-emerald-600 px-3 py-2 text-white sm:px-4 md:flex-nowrap md:gap-4">
      {/* Izquierda: marca */}
      <Link href="/" className="order-1 flex shrink-0 items-center gap-2 hover:opacity-95 sm:gap-3">
        <Image
          src="/logo-camelia.png"
          alt="Camelia Biotech"
          width={40}
          height={40}
          className="h-9 w-9 object-contain sm:h-10 sm:w-10"
          priority
        />
        <span className="whitespace-nowrap text-lg font-bold text-white sm:text-2xl">
          Camelia Biotech
        </span>
      </Link>

      {/* Derecha: perfil y cierre de sesión */}
      <div className="order-2 ml-auto shrink-0 md:order-3 md:ml-0">
        {usuario ? (
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/40 px-1.5 py-1 sm:gap-2 sm:px-2 sm:py-1.5 sm:pl-1.5">
            <IconoPerfil />
            <span className="max-w-[5rem] truncate text-sm font-medium text-white sm:max-w-[10rem] sm:text-base md:max-w-[14rem]">
              {usuario.nombre}
            </span>
            <button
              type="button"
              onClick={() => void salir()}
              className="rounded-full bg-rose-300 px-2.5 py-1 text-xs font-medium text-rose-950 transition-colors hover:bg-rose-200 sm:px-3 sm:text-sm"
            >
              Salir
            </button>
          </div>
        ) : (
          <div className="h-10" />
        )}
      </div>

      {/* Centro: navegación */}
      <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto pb-1 md:order-2 md:w-auto md:flex-1 md:justify-center md:overflow-visible md:pb-0">
        <Link href="/exploracion" className={claseEnlace(activa === "exploracion")}>
          Exploración
        </Link>
        <Link href="/muestras" className={claseEnlace(activa === "muestras")}>
          Muestras y campañas
        </Link>
        <Link href="/prioridades" className={claseEnlace(activa === "prioridades")}>
          Prioridades
          {criticas > 0 && (
            <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-semibold leading-none text-white">
              {criticas}
            </span>
          )}
        </Link>
        <Link href="/ensayos/nuevo" className={claseEnlace(activa === "ensayos")}>
          Nuevo ensayo
        </Link>
      </nav>
    </header>
  );
}
