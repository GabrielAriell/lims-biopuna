"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Filter,
  GitCompare,
  Minus,
  RefreshCw,
} from "lucide-react";

import Cargando from "@/components/Cargando";
import MarcoDashboard from "@/components/MarcoDashboard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pedirJson } from "@/lib/api";
import { API_URL } from "@/lib/config";

const TODOS = "__todos__";

const ITEM_SELECT =
  "cursor-pointer text-sm dark:data-[highlighted]:bg-emerald-950 dark:data-[highlighted]:text-emerald-200";

const TRIGGER_SELECT =
  "cursor-pointer rounded-lg border-slate-300 px-3 py-2 text-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50";

interface Estadistica {
  n: number;
  media: number | null;
  desvio: number | null;
  min: number | null;
  max: number | null;
}

interface FraccionResumen {
  fraccion: string;
  porcentaje: Estadistica;
  g_dl: Estadistica;
}

interface GrupoSalud {
  grupo: string;
  ensayos: number;
  animales: number;
  relacion_ag: Estadistica;
  proteinas_totales: Estadistica;
  albumina_pct: Estadistica;
}

interface BloqueSalud {
  total_ensayos: number;
  total_animales: number;
  relacion_ag: Estadistica;
  proteinas_totales: Estadistica;
  fracciones: FraccionResumen[];
  por_especie: GrupoSalud[];
  por_departamento: GrupoSalud[];
  por_localidad: GrupoSalud[];
  por_campana: GrupoSalud[];
}

interface PuntoTiempo {
  clave: string;
  etiqueta: string;
  estacion: string;
  anio: number;
  animales: number;
  ensayos: number;
  relacion_ag: Estadistica;
  proteinas_totales: Estadistica;
  albumina_pct: Estadistica;
}

interface RespuestaSalud {
  principal: BloqueSalud;
  comparacion: BloqueSalud | null;
  opciones_filtro: {
    especies: string[];
    departamentos: string[];
    localidades: string[];
    campanas: { id_campana: number; nombre: string }[];
  };
  linea_tiempo: PuntoTiempo[];
}

function fmt(valor: number | null | undefined, dec = 2): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "—";
  return valor.toFixed(dec);
}

function VariacionBadge({ actual, base }: { actual: number | null; base: number | null }) {
  if (actual === null || base === null || base === 0) return null;
  const diff = actual - base;
  const pct = (diff / Math.abs(base)) * 100;
  if (Math.abs(diff) < 0.005) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
        <Minus className="h-3 w-3" /> Sin cambio
      </span>
    );
  }
  const sube = diff > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${sube ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
        }`}
    >
      {sube ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {sube ? "+" : ""}
      {diff.toFixed(2)} ({sube ? "+" : ""}
      {pct.toFixed(1)}%)
    </span>
  );
}

function LineaTiempoEstacional({ puntos }: { puntos: PuntoTiempo[] }) {
  const [metrica, setMetrica] = useState<"relacion_ag" | "proteinas_totales" | "albumina_pct">("relacion_ag");
  const [indiceActivo, setIndiceActivo] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const activos = puntos.filter((p) => p[metrica].media !== null);
  const seleccionado =
    indiceActivo !== null && activos[indiceActivo]
      ? activos[indiceActivo]
      : activos[activos.length - 1] ?? null;

  const valores = activos.map((p) => p[metrica].media as number);
  const minRaw = valores.length ? Math.min(...valores) : 0;
  const maxRaw = valores.length ? Math.max(...valores) : 2;
  const margen = Math.max((maxRaw - minRaw) * 0.25, metrica === "relacion_ag" ? 0.15 : 0.5);
  const yMin = Math.max(0, minRaw - margen);
  const yMax = maxRaw + margen;

  const pasoX = 148;
  const padIzq = 54;
  const padDer = 48;
  const altoSvg = 235;
  const padTop = 26;
  const padBot = 52;
  const altoUtil = altoSvg - padTop - padBot;
  const anchoSvg = Math.max(640, padIzq + padDer + Math.max(0, activos.length - 1) * pasoX);

  const coords = activos.map((p, idx) => {
    const val = p[metrica].media as number;
    const ratio = yMax === yMin ? 0.5 : (val - yMin) / (yMax - yMin);
    return {
      x: padIzq + idx * pasoX,
      y: padTop + altoUtil * (1 - ratio),
      val,
      punto: p,
    };
  });

  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const areaPoints =
    coords.length > 0
      ? `${coords[0].x},${padTop + altoUtil} ${polylinePoints} ${coords[coords.length - 1].x},${padTop + altoUtil}`
      : "";

  const ticksY = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: padTop + altoUtil * (1 - t),
    valor: yMin + (yMax - yMin) * t,
  }));

  function desplazar(delta: number) {
    scrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  }

  const dec = metrica === "albumina_pct" ? 1 : 2;
  const unidad = metrica === "proteinas_totales" ? " g/dL" : metrica === "albumina_pct" ? "%" : "";

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">
            Evolución Estacional Automática (Línea de Tiempo)
          </h2>
          <p className="text-xs text-slate-500">
            Clasificación automática por temporada climática (1° Verano, 1° Invierno, 2° Verano, 2° Invierno...). Desliza horizontalmente para recorrer la serie.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {(
              [
                { id: "relacion_ag", label: "Relación A/G" },
                { id: "proteinas_totales", label: "Prot. Totales" },
                { id: "albumina_pct", label: "Albúmina %" },
              ] as const
            ).map((m) => (
              <Button
                key={m.id}
                type="button"
                size="sm"
                variant={metrica === m.id ? "default" : "ghost"}
                onClick={() => setMetrica(m.id)}
                className={`text-xs font-bold ${metrica === m.id ? "" : "text-slate-600"}`}
              >
                {m.label}
              </Button>
            ))}
          </div>

          <div className="inline-flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => desplazar(-280)}
              title="Desplazar a la izquierda"
            >
              ◀
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => desplazar(280)}
              title="Desplazar a la derecha"
            >
              ▶
            </Button>
          </div>
        </div>
      </div>

      {activos.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center rounded-lg border border-dashed border-slate-200">
          No hay ensayos con fecha suficiente para trazar la línea de tiempo estacional.
        </p>
      ) : (
        <>
          <div
            ref={scrollRef}
            className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3"
          >
            <svg width={anchoSvg} height={altoSvg} className="block select-none">
              <defs>
                <linearGradient id="areaEsmeralda" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id="barraColumna" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.03" />
                </linearGradient>
              </defs>

              {ticksY.map((t, i) => (
                <g key={i}>
                  <line
                    x1={padIzq - 8}
                    y1={t.y}
                    x2={anchoSvg - padDer + 12}
                    y2={t.y}
                    stroke="#059669"
                    strokeOpacity="0.2"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={padIzq - 14}
                    y={t.y + 4}
                    textAnchor="end"
                    className="fill-slate-600"
                    fontSize="10"
                    fontWeight="600"
                  >
                    {t.valor.toFixed(dec)}
                  </text>
                </g>
              ))}

              {coords.map((c, idx) => {
                const esSel = seleccionado?.clave === c.punto.clave;
                const altoBarra = padTop + altoUtil - c.y;
                return (
                  <g key={c.punto.clave}>
                    <line
                      x1={c.x}
                      y1={padTop}
                      x2={c.x}
                      y2={padTop + altoUtil}
                      stroke="#059669"
                      strokeOpacity={esSel ? "0.45" : "0.15"}
                    />
                    <rect
                      x={c.x - 14}
                      y={c.y}
                      width={28}
                      height={Math.max(0, altoBarra)}
                      rx={4}
                      fill="url(#barraColumna)"
                    />
                    <text
                      x={c.x}
                      y={padTop + altoUtil + 18}
                      textAnchor="middle"
                      className={esSel ? "fill-emerald-800" : "fill-slate-700"}
                      fontSize="11"
                      fontWeight={esSel ? "800" : "600"}
                    >
                      {c.punto.etiqueta}
                    </text>
                    <text
                      x={c.x}
                      y={padTop + altoUtil + 33}
                      textAnchor="middle"
                      className="fill-slate-500"
                      fontSize="10"
                    >
                      n = {c.punto.animales}
                    </text>
                    <text
                      x={c.x}
                      y={c.y - 11}
                      textAnchor="middle"
                      className="fill-slate-900"
                      fontSize="11"
                      fontWeight="800"
                    >
                      {c.val.toFixed(dec)}
                      {unidad}
                    </text>
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={18}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setIndiceActivo(idx)}
                      onClick={() => setIndiceActivo(idx)}
                    />
                  </g>
                );
              })}

              {coords.length > 1 && <polygon points={areaPoints} fill="url(#areaEsmeralda)" />}

              {coords.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#059669"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={polylinePoints}
                />
              )}

              {coords.map((c, idx) => {
                const esSel = seleccionado?.clave === c.punto.clave;
                return (
                  <g
                    key={`pt-${c.punto.clave}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setIndiceActivo(idx)}
                    onClick={() => setIndiceActivo(idx)}
                  >
                    {esSel && (
                      <circle
                        cx={c.x}
                        cy={c.y}
                        r={10}
                        fill="#10b981"
                        fillOpacity="0.25"
                      />
                    )}
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={esSel ? 6 : 4.5}
                      fill={esSel ? "#059669" : "#ffffff"}
                      stroke="#059669"
                      strokeWidth="2.5"
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          {seleccionado && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-xs">
              <div className="font-bold text-emerald-950">
                Temporada seleccionada: <span className="text-emerald-700">{seleccionado.etiqueta}</span> ·{" "}
                {seleccionado.animales} animales ({seleccionado.ensayos} ensayos)
              </div>
              <div className="flex flex-wrap gap-4 text-emerald-900">
                <span>
                  A/G: <strong>{fmt(seleccionado.relacion_ag.media, 2)}</strong> (±{fmt(seleccionado.relacion_ag.desvio, 2)})
                </span>
                <span>
                  Prot. Totales: <strong>{fmt(seleccionado.proteinas_totales.media, 2)} g/dL</strong>
                </span>
                <span>
                  Albúmina: <strong>{fmt(seleccionado.albumina_pct.media, 1)}%</strong>
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function SaludPoblacionalPage() {
  const [datos, setDatos] = useState<RespuestaSalud | null>(null);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros territoriales y de especie
  const [especie, setEspecie] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [idCampana, setIdCampana] = useState("");
  const [convenio, setConvenio] = useState("");

  // Temporada 1 (Base / Pre-dieta)
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // Temporada 2 (Seguimiento / Post-dieta)
  const [compararActivo, setCompararActivo] = useState(false);
  const [compDesde, setCompDesde] = useState("");
  const [compHasta, setCompHasta] = useState("");

  // Pestaña de agrupamiento
  const [agrupacion, setAgrupacion] = useState<"localidad" | "departamento" | "campana" | "especie">("localidad");

  const cargar = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (especie) params.set("especie", especie);
      if (departamento) params.set("departamento", departamento);
      if (localidad) params.set("localidad", localidad);
      if (idCampana) params.set("id_campana", idCampana);
      if (convenio) params.set("convenio", convenio);
      if (fechaDesde) params.set("fecha_desde", fechaDesde);
      if (fechaHasta) params.set("fecha_hasta", fechaHasta);
      if (compararActivo) {
        if (compDesde) params.set("comp_desde", compDesde);
        if (compHasta) params.set("comp_hasta", compHasta);
      }
      const query = params.toString();
      const url = `${API_URL}/reportes/salud-poblacional${query ? `?${query}` : ""}`;

      const json = await pedirJson<RespuestaSalud>(url, { method: "GET" });
      setDatos(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron calcular las métricas");
    } finally {
      setCargando(false);
    }
  }, [
    especie,
    departamento,
    localidad,
    idCampana,
    convenio,
    fechaDesde,
    fechaHasta,
    compararActivo,
    compDesde,
    compHasta,
  ]);

  const recargar = useCallback(async () => {
    setActualizando(true);
    await cargar();
    setActualizando(false);
  }, [cargar]);

  useEffect(() => {
    const inicio = window.setTimeout(cargar, 0);
    return () => window.clearTimeout(inicio);
  }, [cargar]);

  const principal = datos?.principal;
  const comp = datos?.comparacion;

  const filasAgrupadas: GrupoSalud[] = !principal
    ? []
    : agrupacion === "localidad"
      ? principal.por_localidad
      : agrupacion === "departamento"
        ? principal.por_departamento
        : agrupacion === "campana"
          ? principal.por_campana
          : principal.por_especie;

  return (
    <MarcoDashboard
      activa="salud"
      titulo="Salud Poblacional (Relación A/G y Proteinograma)"
      subtitulo="Medias poblacionales por especie, localidad y campaña para evaluar estado nutricional y comparar temporadas."
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            {error}
          </div>
        )}

        {/* 1. PANEL DE FILTROS Y COMPARACIÓN DE TEMPORADAS */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Filter className="h-4 w-4 text-emerald-700" />
              <span>Filtros de población y período de muestreo</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCompararActivo((v) => !v)}
                className={`text-xs font-bold ${compararActivo
                  ? "border-emerald-600 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 hover:text-emerald-900"
                  : "text-slate-700"
                  }`}
              >
                <GitCompare className="h-3.5 w-3.5" />
                {compararActivo ? "Comparando 2 temporadas" : "Comparar con otra temporada"}
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => void recargar()}
                disabled={actualizando || cargando}
                className="text-xs font-bold"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${actualizando ? "animate-spin" : ""}`} />
                {actualizando ? "Actualizando..." : "Actualizar"}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="min-w-0">
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Especie
              </label>
              <Select
                value={especie || TODOS}
                onValueChange={(v) => setEspecie(v === TODOS ? "" : v)}
              >
                <SelectTrigger className={TRIGGER_SELECT}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS} className={ITEM_SELECT}>
                    Todas las especies
                  </SelectItem>
                  {(datos?.opciones_filtro.especies || []).filter(Boolean).map((esp) => (
                    <SelectItem key={esp} value={esp} className={ITEM_SELECT}>
                      {esp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0">
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Departamento / Región
              </label>
              <Select
                value={departamento || TODOS}
                onValueChange={(v) => setDepartamento(v === TODOS ? "" : v)}
              >
                <SelectTrigger className={TRIGGER_SELECT}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS} className={ITEM_SELECT}>
                    Todos los departamentos
                  </SelectItem>
                  {(datos?.opciones_filtro.departamentos || []).filter(Boolean).map((dep) => (
                    <SelectItem key={dep} value={dep} className={ITEM_SELECT}>
                      {dep}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0">
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Localidad / Paraje
              </label>
              <Select
                value={localidad || TODOS}
                onValueChange={(v) => setLocalidad(v === TODOS ? "" : v)}
              >
                <SelectTrigger className={TRIGGER_SELECT}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS} className={ITEM_SELECT}>
                    Todas las localidades
                  </SelectItem>
                  {(datos?.opciones_filtro.localidades || []).filter(Boolean).map((loc) => (
                    <SelectItem key={loc} value={loc} className={ITEM_SELECT}>
                      {loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0">
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Campaña / Productor
              </label>
              <Select
                value={idCampana || TODOS}
                onValueChange={(v) => setIdCampana(v === TODOS ? "" : v)}
              >
                <SelectTrigger className={TRIGGER_SELECT}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS} className={ITEM_SELECT}>
                    Todas las campañas
                  </SelectItem>
                  {(datos?.opciones_filtro.campanas || []).map((c) => (
                    <SelectItem
                      key={c.id_campana}
                      value={String(c.id_campana)}
                      className={ITEM_SELECT}
                    >
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0">
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Convenio INTA
              </label>
              <Select
                value={convenio || TODOS}
                onValueChange={(v) => setConvenio(v === TODOS ? "" : v)}
              >
                <SelectTrigger className={TRIGGER_SELECT}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS} className={ITEM_SELECT}>
                    Todos
                  </SelectItem>
                  <SelectItem value="con" className={ITEM_SELECT}>
                    Con convenio INTA
                  </SelectItem>
                  <SelectItem value="sin" className={ITEM_SELECT}>
                    Sin convenio INTA
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Rangos de fechas */}
          <div className="grid gap-4 md:grid-cols-2 pt-2 border-t border-slate-100">
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200/80">
              <p className="text-xs font-bold text-slate-700 mb-2">
                {compararActivo ? "Temporada 1 (Base / Pre-dieta)" : "Rango de fechas de muestreo"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500">Desde</label>
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                    className="w-full cursor-pointer rounded border border-slate-300 bg-white px-2 py-1.5 text-xs transition-colors hover:border-emerald-300 hover:bg-emerald-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500">Hasta</label>
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                    className="w-full cursor-pointer rounded border border-slate-300 bg-white px-2 py-1.5 text-xs transition-colors hover:border-emerald-300 hover:bg-emerald-50"
                  />
                </div>
              </div>
            </div>

            {compararActivo && (
              <div className="rounded-lg bg-emerald-50/60 p-3 border border-emerald-200">
                <p className="text-xs font-bold text-emerald-900 mb-2">
                  Temporada 2 (Seguimiento / Post-dieta)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-emerald-800">Desde</label>
                    <input
                      type="date"
                      value={compDesde}
                      onChange={(e) => setCompDesde(e.target.value)}
                      className="w-full cursor-pointer rounded border border-emerald-300 bg-white px-2 py-1.5 text-xs transition-colors hover:border-emerald-400 hover:bg-emerald-50"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-emerald-800">Hasta</label>
                    <input
                      type="date"
                      value={compHasta}
                      onChange={(e) => setCompHasta(e.target.value)}
                      className="w-full cursor-pointer rounded border border-emerald-300 bg-white px-2 py-1.5 text-xs transition-colors hover:border-emerald-400 hover:bg-emerald-50"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 2. TARJETAS KPI PRINCIPALES (RELACIÓN A/G Y PROTEÍNAS TOTALES) */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col items-center justify-center text-center rounded-xl border border-emerald-200 bg-emerald-50/70 p-5">
            <div className="flex items-center justify-center gap-1.5">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                Media Relación A/G
              </p>
              <Activity className="h-4 w-4 text-emerald-700" />
            </div>
            <p className="mt-2 text-3xl font-black text-emerald-950">
              {cargando ? "…" : fmt(principal?.relacion_ag.media, 2)}
            </p>
            <p className="mt-1 text-xs text-emerald-800">
              DE: ±{fmt(principal?.relacion_ag.desvio, 2)} · Rango: {fmt(principal?.relacion_ag.min, 2)}–{fmt(principal?.relacion_ag.max, 2)}
            </p>
            {comp && (
              <div className="mt-2 w-full pt-2 border-t border-emerald-200/80 flex items-center justify-center gap-2 text-xs">
                <span className="text-emerald-900 font-medium">
                  Temp. 2: <strong>{fmt(comp.relacion_ag.media, 2)}</strong>
                </span>
                <VariacionBadge actual={comp.relacion_ag.media} base={principal?.relacion_ag.media ?? null} />
              </div>
            )}
          </div>

          <div className="flex flex-col items-center justify-center text-center rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Proteínas Totales (Media)
            </p>
            <p className="mt-2 text-3xl font-black text-slate-900">
              {cargando ? "…" : `${fmt(principal?.proteinas_totales.media, 2)} `}
              <span className="text-sm font-semibold text-slate-500">g/dL</span>
            </p>
            <p className="mt-1 text-xs text-slate-600">
              DE: ±{fmt(principal?.proteinas_totales.desvio, 2)} · Rango: {fmt(principal?.proteinas_totales.min, 2)}–{fmt(principal?.proteinas_totales.max, 2)}
            </p>
            {comp && (
              <div className="mt-2 w-full pt-2 border-t border-slate-100 flex items-center justify-center gap-2 text-xs">
                <span>
                  Temp. 2: <strong>{fmt(comp.proteinas_totales.media, 2)} g/dL</strong>
                </span>
                <VariacionBadge
                  actual={comp.proteinas_totales.media}
                  base={principal?.proteinas_totales.media ?? null}
                />
              </div>
            )}
          </div>

          <div className="flex flex-col items-center justify-center text-center rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Animales Muestreados (n)
            </p>
            <p className="mt-2 text-3xl font-black text-slate-900">
              {cargando ? "…" : principal?.total_animales ?? 0}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              En {principal?.total_ensayos ?? 0} corridas electroforéticas
            </p>
            {comp && (
              <p className="mt-2 w-full pt-2 border-t border-slate-100 text-xs text-slate-700">
                Temp. 2: <strong>{comp.total_animales}</strong> animales ({comp.total_ensayos} ensayos)
              </p>
            )}
          </div>

          <div className="flex flex-col items-center justify-center text-center rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Albúmina Media (%)
            </p>
            {(() => {
              const alb = principal?.fracciones.find((f) => f.fraccion === "Albúmina");
              const albComp = comp?.fracciones.find((f) => f.fraccion === "Albúmina");
              return (
                <>
                  <p className="mt-2 text-3xl font-black text-slate-900">
                    {cargando ? "…" : `${fmt(alb?.porcentaje.media, 1)}%`}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Concentración: {fmt(alb?.g_dl.media, 2)} g/dL (±{fmt(alb?.g_dl.desvio, 2)})
                  </p>
                  {comp && (
                    <div className="mt-2 w-full pt-2 border-t border-slate-100 flex items-center justify-center gap-2 text-xs">
                      <span>
                        Temp. 2: <strong>{fmt(albComp?.porcentaje.media, 1)}%</strong>
                      </span>
                      <VariacionBadge
                        actual={albComp?.porcentaje.media ?? null}
                        base={alb?.porcentaje.media ?? null}
                      />
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </section>

        {/* LÍNEA DE TIEMPO ESTACIONAL AUTOMÁTICA */}
        <LineaTiempoEstacional puntos={datos?.linea_tiempo || []} />

        {/* 3. TABLA DE MEDIAS POR LOCALIDAD / REGIÓN / CAMPAÑA / ESPECIE */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Media de Salud Poblacional Agrupada
              </h2>
              <p className="text-xs text-slate-500">
                Indicadores promedio para decisión veterinaria y nutricional por grupo territorial o especie.
              </p>
            </div>

            <div className="inline-flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
              {(
                [
                  { id: "localidad", label: "Por Localidad" },
                  { id: "departamento", label: "Por Departamento" },
                  { id: "campana", label: "Por Campaña / Productor" },
                  { id: "especie", label: "Por Especie" },
                ] as const
              ).map((tab) => (
                <Button
                  key={tab.id}
                  type="button"
                  size="sm"
                  variant={agrupacion === tab.id ? "default" : "ghost"}
                  onClick={() => setAgrupacion(tab.id)}
                  className={`text-xs font-bold ${agrupacion === tab.id ? "" : "text-slate-600"}`}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          </div>

          {cargando ? (
            <Cargando texto="Calculando medias..." />
          ) : filasAgrupadas.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center rounded-lg border border-dashed border-slate-200">
              No hay ensayos guardados que coincidan con los filtros seleccionados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
                    <th className="py-2.5 px-3 font-semibold">Grupo</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Animales (n)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Media A/G</th>
                    <th className="py-2.5 px-3 font-semibold text-right">DE A/G</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Prot. Totales (g/dL)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Albúmina (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filasAgrupadas.map((f) => (
                    <tr key={f.grupo} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{f.grupo}</td>
                      <td className="py-2.5 px-3 text-right text-slate-700">{f.animales}</td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-emerald-800">
                        {fmt(f.relacion_ag.media, 2)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500">
                        ±{fmt(f.relacion_ag.desvio, 2)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-800">
                        {fmt(f.proteinas_totales.media, 2)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-800">
                        {fmt(f.albumina_pct.media, 1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 4. PERFIL PROTEICO PROMEDIO POR FRACCIÓN (6 FRACCIONES) */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <h2 className="text-base font-extrabold text-slate-900 mb-1">
            Perfil Electroforético Promedio por Fracción
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Distribución media porcentual y concentración absoluta (g/dL) de las fracciones séricas.
          </p>

          {!principal || principal.fracciones.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">
              Sin fracciones registradas para los filtros actuales.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
                    <th className="py-2.5 px-3 font-semibold">Fracción</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Media (%)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">DE (%)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Media (g/dL)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">DE (g/dL)</th>
                    {comp && (
                      <>
                        <th className="py-2.5 px-3 font-semibold text-right">
                          Temp. 2 (%)
                        </th>
                        <th className="py-2.5 px-3 font-semibold text-right">
                          Temp. 2 (g/dL)
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {principal.fracciones.map((fr) => {
                    const frComp = comp?.fracciones.find((x) => x.fraccion === fr.fraccion);
                    return (
                      <tr key={fr.fraccion} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{fr.fraccion}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                          {fmt(fr.porcentaje.media, 2)}%
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500">
                          ±{fmt(fr.porcentaje.desvio, 2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                          {fmt(fr.g_dl.media, 2)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500">
                          ±{fmt(fr.g_dl.desvio, 2)}
                        </td>
                        {comp && (
                          <>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-800">
                              {fmt(frComp?.porcentaje.media, 2)}%
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-800">
                              {fmt(frComp?.g_dl.media, 2)}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </MarcoDashboard>
  );
}