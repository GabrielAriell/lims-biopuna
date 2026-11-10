"use client";

import Link from "next/link";

import NuevoEnsayo from "@/components/NuevoEnsayo";
import { useSesion } from "@/components/ProveedorSesion";

type Props = {
  idMuestraInicial: number | null;
};

export default function NuevoEnsayoVista({ idMuestraInicial }: Props) {
  const { usuario } = useSesion();
  const soloLectura = usuario?.rol_sistema === "lectura";

  if (soloLectura) {
    return (
      <section className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-5">
        <h2 className="text-lg font-semibold text-blue-900">Solo lectura</h2>
        <p className="text-sm text-blue-800">
          Tu usuario no tiene permisos para crear o guardar ensayos. Podés
          consultar muestras, ensayos y resultados desde Exploración.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/exploracion"
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Ir a Exploración
          </Link>
          <Link
            href="/muestras"
            className="rounded border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-800 hover:bg-blue-100"
          >
            Ir a Muestras y campañas
          </Link>
        </div>
      </section>
    );
  }

  return <NuevoEnsayo idMuestraInicial={idMuestraInicial} />;
}
