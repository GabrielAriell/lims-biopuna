"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft, MapPin } from "lucide-react";

import Cargando from "@/components/Cargando";
import MarcoDashboard from "@/components/MarcoDashboard";
import FormularioMuestra from "@/components/FormularioMuestra";
import Semaforo from "@/components/Semaforo";
import { useMuestras } from "@/hooks/useMuestras";
import type { Especie, Muestra } from "@/lib/tipos-muestras";

const PLURALES: Record<Especie, string> = {
  Llama: "llamas",
  Vicuña: "vicuñas",
  Oveja: "ovejas",
  Caballo: "caballos",
};

function formatearFecha(iso: string): string {
  const [anio, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${anio}`;
}

function formatearExtraccion(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(fecha);
}

function resumenEspecies(muestras: Muestra[]): string {
  const conteo = new Map<Especie, number>();
  for (const m of muestras) {
    conteo.set(m.especie, (conteo.get(m.especie) ?? 0) + 1);
  }
  return [...conteo.entries()]
    .map(([especie, n]) =>
      n === 1 ? `1 ${especie.toLowerCase()}` : `${n} ${PLURALES[especie]}`,
    )
    .join(" · ");
}

export default function DetalleCampanaCliente({
  idCampana,
}: {
  idCampana: number;
}) {
  const { campanas, muestras, cargando, error, recargar } = useMuestras();

  const campana = useMemo(
    () => campanas.find((c) => c.id_campana === idCampana),
    [campanas, idCampana],
  );

  const susMuestras = useMemo(() => {
    const lista = muestras.filter((m) => m.id_campana === idCampana);
    // Orden natural por código: O-1, O-2, O-10.
    lista.sort((a, b) =>
      a.codigo_animal.localeCompare(b.codigo_animal, "es", { numeric: true }),
    );
    return lista;
  }, [muestras, idCampana]);

  return (
    <MarcoDashboard
      activa="muestras"
      titulo={campana ? campana.localidad_puna : `Campaña #${idCampana}`}
      subtitulo="Muestras de la salida y carga de nuevos animales."
    >
      <div className="space-y-6">
        <Link
          href="/muestras"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a campañas
        </Link>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 shadow-xs">
            {error}
          </div>
        )}

        {cargando ? (
          <Cargando texto="Cargando campaña..." />
        ) : !campana ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-xs">
            <p className="text-base font-semibold text-slate-800">
              La campaña #{idCampana} no existe
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Puede haberse eliminado o el enlace está mal escrito.
            </p>
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-7">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <MapPin className="h-5.5 w-5.5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">
                    {campana.localidad_puna}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Salida {formatearFecha(campana.fecha_salida)}
                    {campana.convenio_inta && " · Convenio INTA"}
                    {" · "}
                    {susMuestras.length}{" "}
                    {susMuestras.length === 1 ? "muestra" : "muestras"}
                    {susMuestras.length > 0 &&
                      ` (${resumenEspecies(susMuestras)})`}
                  </p>
                  {campana.observaciones && (
                    <p className="mt-2 text-sm text-slate-500">
                      {campana.observaciones}
                    </p>
                  )}
                </div>
              </div>
            </section>

            <FormularioMuestra
              campanas={campanas}
              muestras={muestras}
              idCampanaFija={campana.id_campana}
              onCreada={recargar}
            />

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-7">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-bold tracking-tight text-slate-900">
                  Animales de la campaña
                </h2>
                {susMuestras.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {susMuestras.length} cargadas
                  </span>
                )}
              </div>

              {susMuestras.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                  Todavía no hay animales. Usá el formulario de arriba para
                  cargar el primero.
                </p>
              ) : (
                <>
                  {/* Tabla en pantallas medianas+ (muestra ~6 filas, luego scroll) */}
                  <div className="mt-4 hidden max-h-[21rem] overflow-auto sm:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 [&>th]:sticky [&>th]:top-0 [&>th]:border-b [&>th]:border-slate-200 [&>th]:bg-white">
                          <th className="pb-2 pr-4">Animal</th>
                          <th className="pb-2 pr-4">Especie</th>
                          <th className="pb-2 pr-4">Extracción</th>
                          <th className="pb-2 pr-4">Horas</th>
                          <th className="pb-2 pr-4">Estado</th>
                          <th className="pb-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {susMuestras.map((m) => (
                          <tr
                            key={m.id_muestra}
                            className="border-b border-slate-100 last:border-0"
                          >
                            <td className="py-3 pr-4 font-semibold text-slate-900">
                              {m.codigo_animal}
                            </td>
                            <td className="py-3 pr-4 text-slate-600">
                              {m.especie}
                            </td>
                            <td className="py-3 pr-4 text-slate-600">
                              {formatearExtraccion(m.fecha_hora_extraccion)}
                            </td>
                            <td className="py-3 pr-4 text-slate-600">
                              {m.horas_transcurridas.toFixed(1)} h
                            </td>
                            <td className="py-3 pr-4">
                              <Semaforo estado={m.estado_48h} />
                            </td>
                            <td className="py-3 text-right">
                              <Link
                                href={`/muestras/${m.id_muestra}`}
                                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                              >
                                Ver detalle →
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Tarjetas compactas en celular (~4 visibles, luego scroll) */}
                  <ul className="mt-4 max-h-[26rem] space-y-2.5 overflow-y-auto pr-1 sm:hidden">
                    {susMuestras.map((m) => (
                      <li
                        key={m.id_muestra}
                        className="rounded-xl border border-slate-200 bg-white p-3.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="min-w-0 text-[15px] font-semibold text-slate-900">
                            {m.codigo_animal}
                            <span className="font-normal text-slate-600">
                              {" "}
                              · {m.especie}
                            </span>
                          </p>
                          <Semaforo estado={m.estado_48h} />
                        </div>
                        <p className="mt-0.5 text-sm text-slate-500">
                          Extraída{" "}
                          {formatearExtraccion(m.fecha_hora_extraccion)} ·{" "}
                          {m.horas_transcurridas.toFixed(1)} h
                        </p>
                        <Link
                          href={`/muestras/${m.id_muestra}`}
                          className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                          Ver detalle →
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </MarcoDashboard>
  );
}
