"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, FileDown, Image as ImagenIcono, Plus, Trash2 } from "lucide-react";

import Cargando from "@/components/Cargando";
import MarcoDashboard from "@/components/MarcoDashboard";
import { useSesion } from "@/components/ProveedorSesion";
import Semaforo from "@/components/Semaforo";
import { eliminarEnsayo, listarEnsayos } from "@/lib/api-ensayos";
import { obtenerMuestra } from "@/lib/api-muestras";
import { exportarMuestraExcel, exportarMuestraPdf } from "@/lib/api-reportes";
import { calcularRelacionAG, esNombreAlbumina, evaluarValor } from "@/lib/rangos-referencia";
import type { EnsayoGuardado } from "@/lib/tipos-ensayos";
import type { Muestra } from "@/lib/tipos-muestras";

const BOTON_PRIMARIO =
  "inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-2xs hover:bg-emerald-700 transition-colors disabled:opacity-50 sm:w-auto";
const BOTON_LINEA =
  "inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 sm:w-auto";

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

function Campo({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {etiqueta}
      </dt>
      <dd className="mt-0.5 text-[15px] font-medium text-slate-900">
        {children}
      </dd>
    </div>
  );
}

export default function DetalleMuestraCliente({
  idMuestra,
}: {
  idMuestra: number;
}) {
  const { usuario } = useSesion();
  const [muestra, setMuestra] = useState<Muestra | null>(null);
  const [ensayos, setEnsayos] = useState<EnsayoGuardado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportando, setExportando] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState<number | null>(null);

  async function recargarDetalle() {
    const [m, e] = await Promise.all([obtenerMuestra(idMuestra), listarEnsayos(idMuestra)]);
    setMuestra(m);
    setEnsayos(e);
  }

  async function onEliminarEnsayo(idEnsayo: number) {
    const confirmar = window.confirm(
      `¿Eliminar el ensayo #${idEnsayo}? Esta acción elimina el ensayo y sus fracciones, y no se puede deshacer.`,
    );
    if (!confirmar) return;
    setEliminando(idEnsayo);
    setError(null);
    try {
      await eliminarEnsayo(idEnsayo);
      await recargarDetalle();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar el ensayo");
    } finally {
      setEliminando(null);
    }
  }

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
    <MarcoDashboard
      activa="muestras"
      titulo={
        muestra
          ? `Muestra ${muestra.codigo_animal} · ${muestra.especie}`
          : `Muestra #${idMuestra}`
      }
      subtitulo="Ficha de la muestra, campaña de origen y ensayos registrados."
    >
      <div className="space-y-6">
        <Link
          href={
            muestra
              ? `/muestras/campana/${muestra.id_campana}`
              : "/muestras"
          }
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
        >
          <ArrowLeft className="h-4 w-4" />
          {muestra ? "Volver a la campaña" : "Volver a campañas"}
        </Link>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 shadow-xs">
            {error}
          </div>
        )}
        {cargando && <Cargando texto="Cargando muestra..." />}

        {muestra && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">
                    {muestra.codigo_animal}
                    <span className="font-medium text-slate-600">
                      {" "}
                      · {muestra.especie}
                    </span>
                  </h2>
                  <Semaforo estado={muestra.estado_48h} />
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {muestra.localidad_puna} · Extraída{" "}
                  {fechaHora(muestra.fecha_hora_extraccion)} ·{" "}
                  {num(muestra.horas_transcurridas, 1)} h transcurridas
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <Link
                  href={`/ensayos/nuevo?muestra=${muestra.id_muestra}`}
                  className={BOTON_PRIMARIO}
                >
                  <Plus className="h-4 w-4" />
                  Nuevo ensayo
                </Link>
                <button
                  type="button"
                  onClick={() => void exportar("xlsx")}
                  disabled={Boolean(exportando)}
                  className={BOTON_LINEA}
                >
                  <FileDown className="h-4 w-4" />
                  {exportando === "xlsx" ? "Exportando..." : "Excel"}
                </button>
                <button
                  type="button"
                  onClick={() => void exportar("pdf")}
                  disabled={Boolean(exportando)}
                  className={BOTON_LINEA}
                >
                  <FileDown className="h-4 w-4" />
                  {exportando === "pdf" ? "Exportando..." : "PDF"}
                </button>
              </div>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
              <Campo etiqueta="Campaña">{muestra.localidad_puna}</Campo>
              <Campo etiqueta="Fecha de salida">
                {fechaCorta(muestra.fecha_salida)}
              </Campo>
              <Campo etiqueta="Extracción">
                {fechaHora(muestra.fecha_hora_extraccion)}
              </Campo>
              <Campo etiqueta="Horas transcurridas">
                {num(muestra.horas_transcurridas, 1)} h
              </Campo>
              <Campo etiqueta="Estado 48 h">
                <Semaforo estado={muestra.estado_48h} />
              </Campo>
              <Campo etiqueta="ID muestra / campaña">
                #{muestra.id_muestra} / #{muestra.id_campana}
              </Campo>
            </dl>
          </section>
        )}

        {!cargando && muestra && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                Ensayos y resultados
              </h2>
              {ensayos.length > 0 && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {ensayos.length}{" "}
                  {ensayos.length === 1 ? "ensayo" : "ensayos"}
                </span>
              )}
            </div>

            {ensayos.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 shadow-xs">
                Esta muestra todavía no tiene ensayos guardados. Analizá una
                tira desde &quot;Nuevo ensayo&quot;.
              </p>
            ) : (
              ensayos.map((ensayo) => (
                <article
                  key={ensayo.id_ensayo}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-slate-900">
                        Ensayo #{ensayo.id_ensayo}
                      </h3>
                      <p className="mt-0.5 text-sm text-slate-600">
                        Corrida: {fechaHora(ensayo.fecha_corrida)} · PT:{" "}
                        {num(ensayo.proteinas_totales_g_dl)} g/dL · Método:{" "}
                        {ensayo.metodo_lectura}
                      </p>
                      <p className="text-sm text-slate-600">
                        Investigador:{" "}
                        <span className="font-semibold text-slate-800">
                          {ensayo.investigador_nombre || ensayo.id_investigador}
                        </span>
                      </p>
                    </div>
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                      {ensayo.url_imagen_tira && (
                        <a
                          href={ensayo.url_imagen_tira}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50/40 hover:border-emerald-300 sm:w-auto"
                        >
                          <ImagenIcono className="h-4 w-4" />
                          Ver imagen de tira
                        </a>
                      )}
                      {usuario?.rol_sistema === "admin" && (
                        <button
                          type="button"
                          onClick={() => void onEliminarEnsayo(ensayo.id_ensayo)}
                          disabled={eliminando === ensayo.id_ensayo}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 sm:w-auto"
                        >
                          <Trash2 className="h-4 w-4" />
                          {eliminando === ensayo.id_ensayo
                            ? "Eliminando..."
                            : "Eliminar ensayo"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    {(() => {
                      const idxNombrada = ensayo.fracciones.findIndex((f) =>
                        esNombreAlbumina(f.nombre_fraccion),
                      );
                      let idxAlbumina = idxNombrada >= 0 ? idxNombrada : -1;
                      if (idxAlbumina < 0) {
                        let mejor = -1;
                        ensayo.fracciones.forEach((f, i) => {
                          const v = f.concentracion_g_dl ?? f.porcentaje_relativo ?? f.area_integrada;
                          if (v != null && Number.isFinite(v) && v > mejor) {
                            mejor = v;
                            idxAlbumina = i;
                          }
                        });
                      }
                      return (
                        <table className="min-w-max w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                              <th className="pb-2 pr-3">Fracción</th>
                              <th className="pb-2 pr-3">%</th>
                              <th className="pb-2 pr-3">g/dL</th>
                              <th className="pb-2 pr-3">Área</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ensayo.fracciones.map((f, i) => {
                              const ev = evaluarValor(
                                muestra.especie,
                                f.nombre_fraccion,
                                f.concentracion_g_dl,
                              );
                              const evAlb =
                                !ev && i === idxAlbumina
                                  ? evaluarValor(muestra.especie, "Albúmina", f.concentracion_g_dl)
                                  : null;
                              const evFinal = ev ?? evAlb;
                              const clase =
                                evFinal?.nivel === "critico"
                                  ? "rounded bg-red-100 px-1.5 text-red-900 font-semibold"
                                  : evFinal?.nivel === "alerta"
                                    ? "rounded bg-amber-100 px-1.5 text-amber-900 font-semibold"
                                    : "";
                              return (
                                <tr key={`${f.nombre_fraccion}-${i}`} className="border-b border-slate-100 last:border-0">
                                  <td className="whitespace-nowrap py-2.5 pr-3 font-semibold text-slate-900">
                                    {f.nombre_fraccion}
                                  </td>
                                  <td className="whitespace-nowrap py-2.5 pr-3 text-slate-600">
                                    {num(f.porcentaje_relativo)}
                                  </td>
                                  <td
                                    className="whitespace-nowrap py-2.5 pr-3 text-slate-900"
                                    title={
                                      evFinal && evFinal.nivel !== "normal"
                                        ? evFinal.etiqueta
                                        : undefined
                                    }
                                  >
                                    <span className={clase || undefined}>
                                      {num(f.concentracion_g_dl)}
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap py-2.5 pr-3 text-slate-600">
                                    {num(f.area_integrada, 4)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      );
                    })()}
                    {(() => {
                      const ag = ensayo.relacion_ag ?? calcularRelacionAG(ensayo.fracciones, ensayo.proteinas_totales_g_dl);
                      const evAg = evaluarValor(muestra.especie, "A/G", ag);
                      const claseAg =
                        evAg?.nivel === "critico"
                          ? "bg-red-100 text-red-900"
                          : evAg?.nivel === "alerta"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-slate-100 text-slate-700";
                      const idxNombrada = ensayo.fracciones.findIndex((f) =>
                        esNombreAlbumina(f.nombre_fraccion),
                      );
                      let idxAlbumina = idxNombrada >= 0 ? idxNombrada : -1;
                      if (idxAlbumina < 0) {
                        let mejor = -1;
                        ensayo.fracciones.forEach((f, i) => {
                          const v = f.concentracion_g_dl ?? f.porcentaje_relativo ?? f.area_integrada;
                          if (v != null && Number.isFinite(v) && v > mejor) {
                            mejor = v;
                            idxAlbumina = i;
                          }
                        });
                      }
                      const etiquetas = Array.from(
                        new Set(
                          [
                            ...ensayo.fracciones
                              .map((f, i) => {
                                const ev = evaluarValor(muestra.especie, f.nombre_fraccion, f.concentracion_g_dl);
                                const evAlb =
                                  !ev && i === idxAlbumina
                                    ? evaluarValor(muestra.especie, "Albúmina", f.concentracion_g_dl)
                                    : null;
                                const evFinal = ev ?? evAlb;
                                const etiquetaParam = ev ? f.nombre_fraccion : evAlb ? "Albúmina" : f.nombre_fraccion;
                                return evFinal && evFinal.nivel !== "normal" && evFinal.etiqueta
                                  ? `${etiquetaParam}: ${evFinal.etiqueta}`
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
                              className={`mt-3 inline-block rounded-lg px-2.5 py-1 text-sm font-semibold ${claseAg}`}
                              title={evAg && evAg.nivel !== "normal" ? evAg.etiqueta : undefined}
                            >
                              Relación A/G: {num(ag)}
                            </p>
                          )}
                          {etiquetas.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              {etiquetas.map((e) => (
                                <p key={e} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900">
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
    </MarcoDashboard>
  );
}
