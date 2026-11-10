"use client";

import Link from "next/link";
import { useMemo } from "react";

import Encabezado from "@/components/Encabezado";
import { useSesion } from "@/components/ProveedorSesion";
import { useMuestras } from "@/hooks/useMuestras";
import type { EstadoMuestra } from "@/lib/tipos-muestras";

const ESTADOS: { clave: EstadoMuestra; titulo: string; clase: string }[] = [
  { clave: "verde", titulo: "En plazo", clase: "border-green-300 bg-green-50 text-green-900" },
  { clave: "amarillo", titulo: "Atención", clase: "border-yellow-300 bg-yellow-50 text-yellow-900" },
  { clave: "rojo", titulo: "Fuera de plazo", clase: "border-red-300 bg-red-50 text-red-900" },
  { clave: "procesada", titulo: "Procesadas", clase: "border-gray-300 bg-gray-100 text-gray-800" },
];

export default function InicioCliente() {
  const { usuario } = useSesion();
  const { muestras, cargando } = useMuestras();

  const resumen = useMemo(() => {
    const cuenta: Record<EstadoMuestra, number> = {
      verde: 0,
      amarillo: 0,
      rojo: 0,
      procesada: 0,
    };
    for (const m of muestras) cuenta[m.estado_48h] += 1;
    return cuenta;
  }, [muestras]);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <Encabezado activa="inicio" />

        <section className="space-y-1">
          <h2 className="text-2xl font-bold">
            Hola{usuario?.nombre ? `, ${usuario.nombre}` : ""}
          </h2>
          <p className="text-gray-600">
            Elegí una sección para trabajar. Desde acá podés registrar campañas y
            muestras, analizar y guardar ensayos, o explorar todos los datos.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <TarjetaAcceso
            href="/exploracion"
            titulo="Exploración"
            descripcion="Buscar y ver todos los datos: muestras, ensayos y resultados por especie, animal, localidad, investigador o fecha. Exportar a Excel/PDF."
            accion="Ir a exploración"
          />
          <TarjetaAcceso
            href="/muestras"
            titulo="Muestras y campañas"
            descripcion="Registrar campañas y muestras, revisar el semáforo de 48 horas y el estado operativo."
            accion="Ir a muestras"
          />
          <TarjetaAcceso
            href="/ensayos/nuevo"
            titulo="Nuevo ensayo"
            descripcion="Analizar una tira, ajustar límites, revisar fracciones y guardar el ensayo asociado a una muestra."
            accion="Nuevo ensayo"
            destacado
          />
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Estado de muestras (48 h)</h3>
              <p className="text-sm text-gray-500">
                Resumen rápido del semáforo. Verde &lt; 24 h, amarillo 24–40 h, rojo &gt; 40 h.
              </p>
            </div>
            <Link
              href="/muestras"
              className="text-sm font-medium text-blue-700 underline"
            >
              Ver detalle en Muestras
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ESTADOS.map((e) => (
              <div key={e.clave} className={`rounded-lg border p-4 ${e.clase}`}>
                <p className="text-sm font-medium">{e.titulo}</p>
                <p className="text-2xl font-bold">
                  {cargando ? "…" : resumen[e.clave]}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function TarjetaAcceso({
  href,
  titulo,
  descripcion,
  accion,
  destacado,
}: {
  href: string;
  titulo: string;
  descripcion: string;
  accion: string;
  destacado?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex flex-col rounded-lg border bg-white p-5 transition-shadow hover:shadow-md ${
        destacado ? "border-blue-300" : "border-gray-200"
      }`}
    >
      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-700">
        {titulo}
      </h3>
      <p className="mt-2 flex-1 text-sm text-gray-600">{descripcion}</p>
      <span
        className={`mt-4 inline-flex w-fit rounded px-3 py-1.5 text-sm font-medium ${
          destacado
            ? "bg-blue-600 text-white"
            : "border border-gray-300 text-gray-700 group-hover:bg-gray-50"
        }`}
      >
        {accion}
      </span>
    </Link>
  );
}
