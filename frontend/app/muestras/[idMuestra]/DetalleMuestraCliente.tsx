"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import Semaforo from "@/components/Semaforo";
import { listarEnsayos } from "@/lib/api-ensayos";
import { obtenerMuestra } from "@/lib/api-muestras";
import { exportarMuestraExcel, exportarMuestraPdf } from "@/lib/api-reportes";
import { calcularRelacionAG, evaluarValor } from "@/lib/rangos-referencia";
import type { EnsayoGuardado } from "@/lib/tipos-ensayos";
import type { Muestra } from "@/lib/tipos-muestras";

function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function fechaCorta(iso: string): string {
  const [anio, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${anio}`;
}

function num(n: number, dec = 2): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

export default function DetalleMuestraCliente({
  idMuestra,
}: {
  idMuestra: number;
}) {
  const [muestra, setMuestra] = useState<Muestra | null>(null);
  const [ensayos, setEnsayos] = useState<EnsayoGuardado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportando, setExportando] = useState<string | null>(null);

  async function exportar(formato: "xlsx" | "pdf") {
    setExportando(formato);
    try {
      if (formato === "xlsx") await exportarMuestraExcel(idMuestra);
      else await exportarMuestraPdf(idMuestra);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo exportar");
    } finally {
      setExportando(null);
    }
  }

  useEffect(() => {
    if (!Number.isInteger(idMuestra) || idMuestra <= 0) return;
    let activo = true;
    Promise.all([obtenerMuestra(idMuestra), listarEnsayos(idMuestra)])
      .then(([m, e]) => {
        if (!activo) return;
        setMuestra(m);
        setEnsayos(e);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!activo) return;
        setError(
          err instanceof Error ? err.message : "No se pudo cargar el detalle",
        );
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [idMuestra]);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Detalle de muestra #{idMuestra}</h1>
            <p className="text-sm text-gray-600">
              Información de la muestra, campaña y todos los ensayos/resultados.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/muestras"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Volver a muestras
            </Link>
            {muestra && (
              <Link
                href={`/ensayos/nuevo?muestra=${muestra.id_muestra}`}
                className="whitespace-nowrap rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
              >
                Nuevo ensayo
              </Link>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-red-800">
            {error}
          </div>
        )}
        {cargando && <p className="text-sm text-gray-500">Cargando...</p>}

        {muestra && (
          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Muestra y campaña</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void exportar("xlsx")}
                  disabled={Boolean(exportando)}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  {exportando === "xlsx" ? "Exportando..." : "Exportar Excel"}
                </button>
                <button
                  type="button"
                  onClick={() => void exportar("pdf")}
                  disabled={Boolean(exportando)}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  {exportando === "pdf" ? "Exportando..." : "Exportar PDF"}
                </button>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-gray-500">Código animal</dt>
                <dd className="font-medium">{muestra.codigo_animal}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Especie</dt>
                <dd>{muestra.especie}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-gray-500">Ubicación / campaña</dt>
                <dd>{muestra.localidad_puna}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Fecha salida</dt>
                <dd>{fechaCorta(muestra.fecha_salida)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Extracción</dt>
                <dd>{fechaHora(muestra.fecha_hora_extraccion)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Horas transcurridas</dt>
                <dd>{num(muestra.horas_transcurridas, 1)} h</dd>
              </div>
              <div>
                <dt className="text-gray-500">Estado 48 h</dt>
                <dd><Semaforo estado={muestra.estado_48h} /></dd>
              </div>
              <div>
                <dt className="text-gray-500">ID muestra / campaña</dt>
                <dd>#{muestra.id_muestra} / #{muestra.id_campana}</dd>
              </div>
            </dl>
          </section>
        )}

        {!cargando && muestra && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">
              Ensayos y resultados ({ensayos.length})
            </h2>
            {ensayos.length === 0 ? (
              <p className="rounded border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
                Esta muestra todavía no tiene ensayos guardados.
              </p>
            ) : (
              ensayos.map((ensayo) => (
                <article
                  key={ensayo.id_ensayo}
                  className="rounded-lg border border-gray-200 bg-white p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">Ensayo #{ensayo.id_ensayo}</h3>
                      <p className="text-sm text-gray-600">
                        Corrida: {fechaHora(ensayo.fecha_corrida)} · PT:{" "}
                        {num(ensayo.proteinas_totales_g_dl)} g/dL · Método:{" "}
                        {ensayo.metodo_lectura}
                      </p>
                      <p className="text-sm text-gray-600">
                        Investigador (corrió/cargó):{" "}
                        <span className="font-medium text-gray-800">
                          {ensayo.investigador_nombre || ensayo.id_investigador}
                        </span>
                      </p>
                    </div>
                    {ensayo.url_imagen_tira && (
                      <a
                        href={ensayo.url_imagen_tira}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-blue-700 underline"
                      >
                        Ver imagen de tira
                      </a>
                    )}
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-max w-full text-sm">
                      <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="whitespace-nowrap px-3 py-2">Fracción</th>
                          <th className="whitespace-nowrap px-3 py-2">%</th>
                          <th className="whitespace-nowrap px-3 py-2">g/dL</th>
                          <th className="whitespace-nowrap px-3 py-2">Área</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ensayo.fracciones.map((f) => {
                          const ev = evaluarValor(muestra.especie, f.nombre_fraccion, f.concentracion_g_dl);
                          const clase =
                            ev?.nivel === "critico"
                              ? "bg-red-100 text-red-900 font-medium"
                              : ev?.nivel === "alerta"
                                ? "bg-yellow-100 text-yellow-900 font-medium"
                                : "";
                          return (
                            <tr key={f.nombre_fraccion} className="border-t border-gray-100">
                              <td className="whitespace-nowrap px-3 py-2 font-medium">{f.nombre_fraccion}</td>
                              <td className="whitespace-nowrap px-3 py-2">{num(f.porcentaje_relativo)}</td>
                              <td
                                className={`whitespace-nowrap px-3 py-2 ${clase}`}
                                title={ev && ev.nivel !== "normal" ? ev.etiqueta : undefined}
                              >
                                {num(f.concentracion_g_dl)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2">{num(f.area_integrada, 4)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {(() => {
                      const ag = ensayo.relacion_ag ?? calcularRelacionAG(ensayo.fracciones, ensayo.proteinas_totales_g_dl);
                      const evAg = evaluarValor(muestra.especie, "A/G", ag);
                      const claseAg =
                        evAg?.nivel === "critico"
                          ? "bg-red-100 text-red-900"
                          : evAg?.nivel === "alerta"
                            ? "bg-yellow-100 text-yellow-900"
                            : "";
                      const etiquetas = Array.from(
                        new Set(
                          [
                            ...ensayo.fracciones
                              .map((f) => {
                                const ev = evaluarValor(muestra.especie, f.nombre_fraccion, f.concentracion_g_dl);
                                return ev && ev.nivel !== "normal" && ev.etiqueta
                                  ? `${f.nombre_fraccion}: ${ev.etiqueta}`
                                  : null;
                              })
                              .filter((x): x is string => Boolean(x)),
                            evAg && evAg.nivel !== "normal" && evAg.etiqueta ? `A/G: ${evAg.etiqueta}` : null,
                          ].filter((x): x is string => Boolean(x)),
                        ),
                      );
                      return (
                        <>
                          {ag !== null && (
                            <p
                              className={`mt-2 inline-block rounded px-2 py-1 text-sm font-medium ${claseAg}`}
                              title={evAg && evAg.nivel !== "normal" ? evAg.etiqueta : undefined}
                            >
                              Relación A/G: {num(ag)}
                            </p>
                          )}
                          {etiquetas.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {etiquetas.map((e) => (
                                <p key={e} className="rounded border border-yellow-200 bg-yellow-50 px-2 py-1 text-xs text-yellow-900">
                                  {e}
                                </p>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </article>
              ))
            )}
          </section>
        )}
      </div>
    </main>
  );
}
