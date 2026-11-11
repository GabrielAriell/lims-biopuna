"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

import Encabezado from "@/components/Encabezado";
import { useSesion } from "@/components/ProveedorSesion";
import { construirAlertasCriticas } from "@/lib/alertas";
import { useMuestras } from "@/hooks/useMuestras";
import type { EstadoMuestra } from "@/lib/tipos-muestras";

const ESTADOS: { clave: EstadoMuestra; titulo: string; clase: string }[] = [
  { clave: "verde", titulo: "En plazo", clase: "border-green-300 bg-green-50 text-green-900" },
  { clave: "amarillo", titulo: "Atención", clase: "border-yellow-300 bg-yellow-50 text-yellow-900" },
  { clave: "rojo", titulo: "Fuera de plazo", clase: "border-red-300 bg-red-50 text-red-900" },
  { clave: "procesada", titulo: "Procesadas", clase: "border-gray-300 bg-gray-100 text-gray-800" },
];

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

  const criticas = useMemo(() => construirAlertasCriticas(muestras), [muestras]);
  const vistaPrevia = useMemo(() => {
    if (criticas.length > 0) return null;
    // Vista previa temporal para revisar diseño cuando no hay alertas reales.
    const pendientes = muestras
      .filter((m) => m.estado_48h !== "procesada")
      .sort((a, b) => b.horas_transcurridas - a.horas_transcurridas)
      .slice(0, 2)
      .map((m) => ({
        clave: `${m.id_muestra}:preview`,
        muestra: { ...m, horas_transcurridas: Math.max(m.horas_transcurridas, 41.5) },
      }));
    if (pendientes.length === 0) {
      return [
        {
          clave: "preview-ejemplo",
          muestra: {
            codigo_animal: "EJ-001",
            localidad_puna: "Localidad de ejemplo",
            horas_transcurridas: 42.0,
          },
        },
      ];
    }
    return pendientes;
  }, [criticas.length, muestras]);

  const alertasMostradas = criticas.length > 0 ? criticas : null;

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        <Encabezado activa="inicio" />

        {(alertasMostradas || vistaPrevia) && (
          <section
            aria-label="Alertas críticas de muestras"
            className="rounded-xl border border-red-300 bg-red-50 p-4 shadow-sm"
          >
            <h2 className="text-base font-semibold text-red-900 sm:text-lg">
              ⚠ {(alertasMostradas ? alertasMostradas.length : vistaPrevia!.length)}{" "}
              {(alertasMostradas ? alertasMostradas.length : vistaPrevia!.length) === 1
                ? "muestra en riesgo crítico"
                : "muestras en riesgo crítico"}
              {" "}(pendientes, &gt; 40 h y ≤ 48 h)
            </h2>
            <p className="mt-1 text-sm text-red-800">
              Cola priorizada (FIFO biológica): procesar primero las de mayor tiempo transcurrido.
            </p>
            {!alertasMostradas && (
              <p className="mt-1 text-xs font-medium text-amber-800">
                Vista previa temporal del diseño (sin alertas reales en la ventana &gt;40 h y ≤48 h).
              </p>
            )}
            <ul className="mt-3 space-y-2">
              {(alertasMostradas ?? vistaPrevia!).map((alerta) => (
                <li
                  key={alerta.clave}
                  className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-gray-800"
                >
                  <p className="font-medium text-red-900">
                    [{alerta.muestra.codigo_animal}] · {alerta.muestra.localidad_puna} · cumple{" "}
                    {alerta.muestra.horas_transcurridas.toFixed(1)} h desde la extracción.
                  </p>
                  <p className="text-red-800">
                    Priorizar corrida electroforética inmediatamente.
                  </p>
                </li>
              ))}
            </ul>
          </section>
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
              className="text-sm font-medium text-emerald-700 underline"
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
