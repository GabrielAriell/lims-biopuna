"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

import Encabezado from "@/components/Encabezado";
import { useSesion } from "@/components/ProveedorSesion";
import { construirAlertasCriticas } from "@/lib/alertas";
import { useMuestras } from "@/hooks/useMuestras";

const SECCIONES = [
  {
    href: "/exploracion",
    titulo: "Exploración",
    descripcion:
      "Consultá y buscá todos los datos: muestras, ensayos y resultados por especie, animal, localidad, investigador o fecha. Exportá a Excel o PDF.",
    accion: "Ir a exploración",
    imagen: "/inicio-exploracion.svg",
  },
  {
    href: "/muestras",
    titulo: "Muestras y campañas",
    descripcion:
      "Registrá campañas y muestras, y revisá el semáforo de 48 horas con el estado operativo de cada muestra.",
    accion: "Ir a muestras",
    imagen: "/inicio-muestras.svg",
  },
  {
    href: "/ensayos/nuevo",
    titulo: "Nuevo ensayo",
    descripcion:
      "Analizá una tira, ajustá límites, revisá fracciones y guardá el ensayo asociado a una muestra.",
    accion: "Nuevo ensayo",
    imagen: "/inicio-ensayo.svg",
    destacado: true,
  },
] as const;

export default function InicioCliente() {
  const { usuario } = useSesion();
  const { muestras } = useMuestras();

  const criticas = useMemo(() => construirAlertasCriticas(muestras), [muestras]);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        <Encabezado activa="inicio" />

        {criticas.length > 0 && (
          <Link
            href="/prioridades"
            className="block rounded-xl border border-red-400 bg-red-600 px-4 py-3 text-white shadow-sm transition hover:bg-red-700"
            aria-label="Ver alertas de riesgo crítico en Prioridades"
          >
            <p className="text-sm font-semibold sm:text-base">
              ⚠ {criticas.length}{" "}
              {criticas.length === 1 ? "muestra" : "muestras"} en riesgo crítico{" "}
              <span className="font-normal underline">(ver detalles)</span>
            </p>
          </Link>
        )}

        <section className="rounded-2xl border border-emerald-100 bg-gradient-to-b from-white to-emerald-50/40 px-6 py-10 text-center shadow-sm">
          <Image
            src="/logo-camelia.png"
            alt="Camelia Biotech"
            width={140}
            height={140}
            className="mx-auto h-28 w-28 object-contain sm:h-36 sm:w-36"
            priority
          />
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Camelia Biotech
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-gray-600 sm:text-lg">
            {usuario?.nombre ? `Hola, ${usuario.nombre}. ` : ""}
            Gestión, análisis y trazabilidad de muestras en un solo lugar.
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-center text-xl font-semibold text-gray-800 sm:text-2xl">
            Secciones principales
          </h2>
          <div className="grid gap-5 md:grid-cols-3">
            {SECCIONES.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className={`group flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  "destacado" in s && s.destacado
                    ? "border-emerald-300 ring-1 ring-emerald-100"
                    : "border-gray-200"
                }`}
              >
                <div className="relative aspect-[16/9] w-full bg-gray-50">
                  <Image
                    src={s.imagen}
                    alt={s.titulo}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
                <div className="flex flex-1 flex-col p-5 text-center">
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-emerald-700">
                    {s.titulo}
                  </h3>
                  <p className="mt-2 flex-1 text-sm text-gray-600">{s.descripcion}</p>
                  <span
                    className={`mt-4 inline-flex justify-center rounded-md px-4 py-2 text-sm font-medium ${
                      "destacado" in s && s.destacado
                        ? "bg-emerald-600 text-white"
                        : "border border-gray-300 text-gray-700 group-hover:bg-gray-50"
                    }`}
                  >
                    {s.accion}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
