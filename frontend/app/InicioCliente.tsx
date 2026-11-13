"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  FlaskConical,
  ClipboardList,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Activity,
  ShieldCheck,
} from "lucide-react";

import MarcoDashboard from "@/components/MarcoDashboard";
import { construirAlertasCriticas, construirAlertas } from "@/lib/alertas";
import { useMuestras } from "@/hooks/useMuestras";

export default function InicioCliente() {
  const { muestras } = useMuestras();

  const criticas = useMemo(() => construirAlertasCriticas(muestras), [muestras]);
  const colaUrgentes = useMemo(() => construirAlertas(muestras).slice(0, 4), [muestras]);

  // Conteos por estado del semáforo biológico
  const conteoVerde = useMemo(
    () => muestras.filter((m) => m.estado_48h === "verde").length,
    [muestras],
  );
  const conteoAmarillo = useMemo(
    () => muestras.filter((m) => m.estado_48h === "amarillo").length,
    [muestras],
  );
  const conteoRojo = useMemo(
    () => muestras.filter((m) => m.estado_48h === "rojo").length,
    [muestras],
  );
  const conteoProcesadas = useMemo(
    () => muestras.filter((m) => m.estado_48h === "procesada").length,
    [muestras],
  );

  return (
    <MarcoDashboard activa="inicio" titulo="Inicio">
      <div className="space-y-6 max-w-7xl">
        {/* Banner de Alerta Crítica (si hay muestras > 40 hs de extracción) */}
        {criticas.length > 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white font-black animate-pulse">
                ⚠
              </span>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-red-950">
                  {criticas.length} {criticas.length === 1 ? "muestra urgente" : "muestras urgentes"} (+40 hs)
                </h2>
                <p className="text-xs sm:text-sm text-red-800">
                  Están cerca del límite de 48 horas. Conviene analizarlas cuanto antes.
                </p>
              </div>
            </div>
            <Link
              href="/prioridades"
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-red-700 transition"
            >
              <span>Ver muestras urgentes</span>
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TARJETA HERO PRINCIPAL: ESTACIÓN DE DENSITOMETRÍA DIGITAL
            ───────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/20 to-emerald-100/30 p-6 sm:p-8 shadow-xs">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100/80 px-3 py-1 text-xs font-bold text-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
              <span>Protocolo seguro: Ácido al 5% (no tóxico)</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Análisis digital de tiras
            </h1>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Medición automática de proteínas (*Albúmina, Alfa, Beta, Gamma*) a partir de fotos o escaneos de tiras en segundos.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Link
                href="/ensayos/nuevo"
                className="inline-flex items-center gap-2.5 rounded-2xl bg-emerald-600 px-6 py-3.5 text-sm sm:text-base font-bold text-white shadow-sm hover:bg-emerald-700 hover:shadow-md transition-all active:scale-95"
              >
                <FlaskConical className="h-5 w-5" />
                <span>Analizar tira ahora</span>
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>

              <Link
                href="/muestras"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <ClipboardList className="h-4 w-4 text-slate-500" />
                <span>Registrar muestras</span>
              </Link>
            </div>

            {/* Guía en 3 Pasos */}
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-emerald-100/70 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-200 text-emerald-800 font-bold text-[10px]">1</span>
                <span>Foto o escaneo sobre fondo blanco</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-200 text-emerald-800 font-bold text-[10px]">2</span>
                <span>Ajuste de bandas</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-200 text-emerald-800 font-bold text-[10px]">3</span>
                <span>Cálculo con Proteínas Totales</span>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            CENTRO DE MONITOREO: ESTADO DE MUESTRAS + TRABAJO PENDIENTE
            ───────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tarjeta 1: Estado de muestras (48 Horas) */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-700" />
                  <h2 className="text-base font-bold text-slate-900">
                    Estado de muestras (48h)
                  </h2>
                </div>
                <Link
                  href="/prioridades"
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  Ver detalle →
                </Link>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Tiempo restante desde la extracción para su análisis.
              </p>

              {/* Métricas */}
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-emerald-50/70 border border-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-900">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    A tiempo (&lt; 24 hs)
                  </span>
                  <span className="font-extrabold text-sm">{conteoVerde}</span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-amber-50/70 border border-amber-100 px-3 py-2 text-xs font-semibold text-amber-900">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    Atención (24h - 40h)
                  </span>
                  <span className="font-extrabold text-sm">{conteoAmarillo}</span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-red-50/70 border border-red-100 px-3 py-2 text-xs font-semibold text-red-900">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-pulse" />
                    Urgente (&gt; 40h)
                  </span>
                  <span className="font-extrabold text-sm">{conteoRojo}</span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />
                    Completadas
                  </span>
                  <span className="font-extrabold text-sm">{conteoProcesadas}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <Link
                href="/prioridades"
                className="flex items-center justify-center gap-1.5 w-full rounded-xl bg-slate-100 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition"
              >
                <span>Ver prioridades</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Tarjeta 2: Trabajo pendiente */}
          <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Trabajo pendiente
                  </h2>
                  <p className="text-xs text-slate-500">
                    Muestras ordenadas por orden de llegada y urgencia.
                  </p>
                </div>
                <Link
                  href="/muestras"
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  Ver todas →
                </Link>
              </div>

              <div className="mt-4 overflow-x-auto">
                {colaUrgentes.length > 0 ? (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="pb-2">Animal</th>
                        <th className="pb-2">Especie</th>
                        <th className="pb-2">Origen (Puna)</th>
                        <th className="pb-2">Tiempo</th>
                        <th className="pb-2 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {colaUrgentes.map((alerta) => {
                        const m = alerta.muestra;
                        return (
                          <tr key={alerta.clave} className="hover:bg-slate-50/80 transition">
                            <td className="py-2.5 font-bold text-slate-900">
                              {m.codigo_animal}
                            </td>
                            <td className="py-2.5 text-slate-600">
                              {m.especie}
                            </td>
                            <td className="py-2.5 text-slate-600 truncate max-w-[8rem]">
                              {m.localidad_puna || "Puna jujeña"}
                            </td>
                            <td className="py-2.5">
                              <span
                                className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${
                                  alerta.nivel === "vencida"
                                    ? "bg-red-100 text-red-900"
                                    : alerta.nivel === "por_vencer"
                                      ? "bg-amber-100 text-amber-900"
                                      : "bg-emerald-100 text-emerald-900"
                                }`}
                              >
                                {m.horas_transcurridas} hs
                              </span>
                            </td>
                            <td className="py-2.5 text-right">
                              <Link
                                href={`/ensayos/nuevo?muestra=${m.id_muestra}`}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-600 hover:text-white transition"
                              >
                                <span>Analizar</span>
                                <ArrowRight className="h-3 w-3" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-8 text-center text-slate-400 space-y-2">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500/80" />
                    <p className="text-sm font-semibold text-slate-700">
                      No hay muestras urgentes pendientes
                    </p>
                    <p className="text-xs text-slate-500">
                      Todas las muestras ya fueron analizadas o están a tiempo.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Total de muestras: <strong>{muestras.length}</strong></span>
              <Link
                href="/ensayos/nuevo"
                className="font-bold text-emerald-700 hover:underline"
              >
                + Analizar tira sin muestra
              </Link>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            ACCESOS RÁPIDOS (MUESTRAS & EXPLORACIÓN)
            ───────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          <Link
            href="/muestras"
            className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all flex items-start gap-4"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 group-hover:scale-105 transition-transform">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                Campañas y Muestras
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
                Carga de expediciones en la Puna y registro de animales con fotos de campo y control de tiempos.
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                Ir a muestras <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
          </Link>

          <Link
            href="/exploracion"
            className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all flex items-start gap-4"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 group-hover:scale-105 transition-transform">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                Reportes y Datos
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
                Búsqueda por animal, gráficos de la zona y descarga de planillas Excel para informes.
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-blue-700">
                Ver reportes y descargas <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
          </Link>
        </div>
      </div>
    </MarcoDashboard>
  );
}
