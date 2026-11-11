"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import Encabezado from "@/components/Encabezado";
import GraficosTerritoriales from "@/components/GraficosTerritoriales";
import type {
  ExportacionTerritorial,
  FiltroConvenio,
} from "@/components/GraficosTerritoriales";
import Semaforo from "@/components/Semaforo";
import { listarEnsayos } from "@/lib/api-ensayos";
import { listarCampanas, listarMuestras } from "@/lib/api-muestras";
import {
  exportarEnsayosExcel,
  exportarMuestrasExcel,
  exportarTerritorialPdf,
} from "@/lib/api-reportes";
import type { FiltrosReporte } from "@/lib/api-reportes";
import { calcularRelacionAG, evaluarValor } from "@/lib/rangos-referencia";
import type { EnsayoGuardado } from "@/lib/tipos-ensayos";
import type { Campana, EstadoMuestra, Muestra } from "@/lib/tipos-muestras";

type Vista = "muestras" | "resultados";

type FilaMuestra = Muestra & {
  ensayos: EnsayoGuardado[];
  investigadores: string[];
  ultimaCorrida: string | null;
};

function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function num(n: number | undefined, dec = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

function investigadorEnsayo(e: EnsayoGuardado): string {
  return e.investigador_nombre || e.id_investigador;
}

const ESTADOS: { valor: "" | EstadoMuestra; texto: string }[] = [
  { valor: "", texto: "Todos los estados" },
  { valor: "verde", texto: "Verde · en plazo" },
  { valor: "amarillo", texto: "Amarillo · atención" },
  { valor: "rojo", texto: "Rojo · fuera de plazo" },
  { valor: "procesada", texto: "Procesadas" },
];

export default function ExploracionCliente() {
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [muestras, setMuestras] = useState<Muestra[]>([]);
  const [ensayos, setEnsayos] = useState<EnsayoGuardado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [vista, setVista] = useState<Vista>("muestras");
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"" | EstadoMuestra>("");
  const [filtroCampana, setFiltroCampana] = useState("");
  const [filtroEspecie, setFiltroEspecie] = useState("");
  const [filtroInvestigador, setFiltroInvestigador] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [filtroConvenio, setFiltroConvenio] = useState<FiltroConvenio>("todos");
  const [exportando, setExportando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [c, m, e] = await Promise.all([
        listarCampanas(),
        listarMuestras(),
        listarEnsayos(),
      ]);
      setCampanas(c);
      setMuestras(m);
      setEnsayos(e);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los datos");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const inicio = window.setTimeout(cargar, 0);
    return () => window.clearTimeout(inicio);
  }, [cargar]);

  const ensayosPorMuestra = useMemo(() => {
    const mapa = new Map<number, EnsayoGuardado[]>();
    for (const e of ensayos) {
      const lista = mapa.get(e.id_muestra) ?? [];
      lista.push(e);
      mapa.set(e.id_muestra, lista);
    }
    return mapa;
  }, [ensayos]);

  const investigadores = useMemo(() => {
    const set = new Set<string>();
    for (const e of ensayos) set.add(investigadorEnsayo(e));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [ensayos]);

  const especies = useMemo(() => {
    const set = new Set(muestras.map((m) => m.especie).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [muestras]);

  const filasMuestra: FilaMuestra[] = useMemo(() => {
    return muestras.map((m) => {
      const es = ensayosPorMuestra.get(m.id_muestra) ?? [];
      const inv = Array.from(new Set(es.map(investigadorEnsayo))).sort((a, b) =>
        a.localeCompare(b, "es"),
      );
      const ultima =
        es.length > 0
          ? es
              .map((e) => e.fecha_corrida)
              .sort()
              .at(-1) ?? null
          : null;
      return { ...m, ensayos: es, investigadores: inv, ultimaCorrida: ultima };
    });
  }, [muestras, ensayosPorMuestra]);

  const muestrasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const invBuscado = filtroInvestigador.trim().toLowerCase();
    return filasMuestra.filter((m) => {
      if (filtroCampana && m.id_campana !== Number(filtroCampana)) return false;
      if (filtroEstado && m.estado_48h !== filtroEstado) return false;
      if (filtroEspecie && m.especie !== filtroEspecie) return false;
      if (invBuscado && !m.investigadores.some((i) => i.toLowerCase().includes(invBuscado))) {
        return false;
      }
      if (texto) {
        const hay = [
          m.codigo_animal,
          m.especie,
          m.localidad_puna,
          ...m.investigadores,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(texto)) return false;
      }
      const dia = m.fecha_hora_extraccion.slice(0, 10);
      if (fechaDesde && dia < fechaDesde) return false;
      if (fechaHasta && dia > fechaHasta) return false;
      return true;
    });
  }, [
    filasMuestra,
    busqueda,
    filtroEstado,
    filtroCampana,
    filtroEspecie,
    filtroInvestigador,
    fechaDesde,
    fechaHasta,
  ]);

  const resultadosFiltrados = useMemo(() => {
    const ids = new Set(muestrasFiltradas.map((m) => m.id_muestra));
    const muestraPorId = new Map(muestras.map((m) => [m.id_muestra, m]));
    const filas: Array<{
      ensayo: EnsayoGuardado;
      muestra: Muestra | undefined;
      fraccion: EnsayoGuardado["fracciones"][number] | null;
    }> = [];
    for (const e of ensayos) {
      if (!ids.has(e.id_muestra)) continue;
      const m = muestraPorId.get(e.id_muestra);
      const fracciones = e.fracciones?.length ? e.fracciones : [null];
      for (const f of fracciones) filas.push({ ensayo: e, muestra: m, fraccion: f });
    }
    return filas;
  }, [ensayos, muestras, muestrasFiltradas]);

  const resumen = useMemo(() => {
    const estados: Record<EstadoMuestra, number> = {
      verde: 0,
      amarillo: 0,
      rojo: 0,
      procesada: 0,
    };
    for (const m of muestras) estados[m.estado_48h] += 1;
    return {
      muestras: muestras.length,
      ensayos: ensayos.length,
      fracciones: ensayos.reduce((acc, e) => acc + (e.fracciones?.length ?? 0), 0),
      especies: especies.length,
      investigadores: investigadores.length,
      estados,
    };
  }, [muestras, ensayos, especies.length, investigadores.length]);

  const filtrosReporte = useMemo<FiltrosReporte>(() => {
    return {
      idCampana: filtroCampana || undefined,
      especie: filtroEspecie || undefined,
      estado: filtroEstado || undefined,
      convenio: filtroConvenio === "todos" ? undefined : filtroConvenio,
      fechaDesde: fechaDesde || undefined,
      fechaHasta: fechaHasta || undefined,
      busqueda: busqueda.trim() || undefined,
      investigador: filtroInvestigador || undefined,
    };
  }, [
    filtroCampana,
    filtroEspecie,
    filtroEstado,
    filtroConvenio,
    fechaDesde,
    fechaHasta,
    busqueda,
    filtroInvestigador,
  ]);

  async function descargar(
    tipo: "ensayos" | "territorial-excel" | "territorial-pdf",
  ) {
    setExportando(tipo);
    try {
      if (tipo === "ensayos") {
        await exportarEnsayosExcel(filtrosReporte);
      } else if (tipo === "territorial-excel") {
        await exportarMuestrasExcel(filtrosReporte);
      } else {
        await exportarTerritorialPdf(filtrosReporte);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo exportar");
    } finally {
      setExportando(null);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <Encabezado activa="exploracion" />

        <div>
          <h1 className="text-2xl font-bold">Exploración de datos</h1>
          <p className="text-sm text-gray-600">
            Vista de consulta (solo lectura): buscá por especie, animal, localidad,
            investigador o fecha; hacé clic en una muestra para ver toda su información.
          </p>
        </div>

        {error && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-red-800">
            {error}
            <button type="button" onClick={() => void cargar()} className="ml-3 underline">
              Reintentar
            </button>
          </div>
        )}

        {!cargando && (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Tarjeta titulo="Muestras" valor={resumen.muestras} />
            <Tarjeta titulo="Ensayos" valor={resumen.ensayos} />
            <Tarjeta titulo="Fracciones" valor={resumen.fracciones} />
            <Tarjeta titulo="Especies" valor={resumen.especies} />
            <Tarjeta titulo="Investigadores" valor={resumen.investigadores} />
            <Tarjeta
              titulo="Atención / fuera plazo"
              valor={resumen.estados.amarillo + resumen.estados.rojo}
              detalle={`A:${resumen.estados.amarillo} R:${resumen.estados.rojo} V:${resumen.estados.verde}`}
            />
          </section>
        )}

        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-end gap-2">
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar: código, especie, localidad, investigador..."
              className="min-w-[280px] flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm"
            />
            <select
              value={filtroEspecie}
              onChange={(e) => setFiltroEspecie(e.target.value)}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
            >
              <option value="">Todas las especies</option>
              {especies.map((esp) => (
                <option key={esp} value={esp}>
                  {esp}
                </option>
              ))}
            </select>
            <select
              value={filtroInvestigador}
              onChange={(e) => setFiltroInvestigador(e.target.value)}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
            >
              <option value="">Todos los investigadores</option>
              {investigadores.map((inv) => (
                <option key={inv} value={inv}>
                  {inv}
                </option>
              ))}
            </select>
            <select
              value={filtroCampana}
              onChange={(e) => setFiltroCampana(e.target.value)}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
            >
              <option value="">Todas las campañas</option>
              {campanas.map((c) => (
                <option key={c.id_campana} value={c.id_campana}>
                  {c.localidad_puna} · {c.fecha_salida}
                </option>
              ))}
            </select>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as "" | EstadoMuestra)}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
            >
              {ESTADOS.map((e) => (
                <option key={e.valor} value={e.valor}>
                  {e.texto}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-sm text-gray-600">
              Desde
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex items-center gap-1 text-sm text-gray-600">
              Hasta
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1 rounded border border-gray-200 bg-gray-50 p-0.5">
              <button
                type="button"
                onClick={() => setVista("muestras")}
                className={`rounded px-3 py-1 text-sm ${
                  vista === "muestras" ? "bg-white font-medium shadow-sm" : "text-gray-600"
                }`}
              >
                Muestras ({muestrasFiltradas.length})
              </button>
              <button
                type="button"
                onClick={() => setVista("resultados")}
                className={`rounded px-3 py-1 text-sm ${
                  vista === "resultados" ? "bg-white font-medium shadow-sm" : "text-gray-600"
                }`}
              >
                Resultados/fracciones ({resultadosFiltrados.length})
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void cargar()}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm"
              >
                Actualizar
              </button>
              <button
                type="button"
                onClick={() => void descargar("ensayos")}
                disabled={Boolean(exportando)}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
              >
                {exportando === "ensayos" ? "..." : "Excel ensayos"}
              </button>
            </div>
          </div>
        </section>

        {!cargando && (
          <GraficosTerritoriales
            muestras={muestrasFiltradas}
            campanas={campanas}
            filtroConvenio={filtroConvenio}
            onCambiarConvenio={setFiltroConvenio}
            onExportarExcel={() => void descargar("territorial-excel")}
            onExportarPdf={() => void descargar("territorial-pdf")}
            exportando={
              exportando === "territorial-excel"
                ? ("excel" as ExportacionTerritorial)
                : exportando === "territorial-pdf"
                  ? ("pdf" as ExportacionTerritorial)
                  : null
            }
          />
        )}

        {cargando ? (
          <p className="text-sm text-gray-500">Cargando datos...</p>
        ) : vista === "muestras" ? (
          <TablaExploracionMuestras filas={muestrasFiltradas} />
        ) : (
          <TablaExploracionResultados filas={resultadosFiltrados} />
        )}
      </div>
    </main>
  );
}

function Tarjeta({
  titulo,
  valor,
  detalle,
}: {
  titulo: string;
  valor: number;
  detalle?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{titulo}</p>
      <p className="text-2xl font-bold text-gray-900">{valor}</p>
      {detalle && <p className="text-xs text-gray-500">{detalle}</p>}
    </div>
  );
}

function TablaExploracionMuestras({ filas }: { filas: FilaMuestra[] }) {
  if (filas.length === 0) {
    return (
      <p className="rounded border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
        No hay muestras que coincidan con los filtros.
      </p>
    );
  }
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-max w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="whitespace-nowrap px-3 py-2">ID</th>
            <th className="whitespace-nowrap px-3 py-2">Código/animal</th>
            <th className="whitespace-nowrap px-3 py-2">Especie</th>
            <th className="whitespace-nowrap px-3 py-2">Ubicación/campaña</th>
            <th className="whitespace-nowrap px-3 py-2">Extracción</th>
            <th className="whitespace-nowrap px-3 py-2">Horas</th>
            <th className="whitespace-nowrap px-3 py-2">Estado</th>
            <th className="whitespace-nowrap px-3 py-2">Ensayos</th>
            <th className="whitespace-nowrap px-3 py-2">Investigador(es)</th>
            <th className="whitespace-nowrap px-3 py-2">Última corrida</th>
            <th className="whitespace-nowrap px-3 py-2">Detalle</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((m) => (
            <tr key={m.id_muestra} className="border-t border-gray-100 align-top">
              <td className="whitespace-nowrap px-3 py-2 text-gray-500">{m.id_muestra}</td>
              <td className="whitespace-nowrap px-3 py-2 font-medium">{m.codigo_animal}</td>
              <td className="whitespace-nowrap px-3 py-2">{m.especie}</td>
              <td className="whitespace-nowrap px-3 py-2">{m.localidad_puna}</td>
              <td className="whitespace-nowrap px-3 py-2">
                {fechaHora(m.fecha_hora_extraccion)}
              </td>
              <td className="whitespace-nowrap px-3 py-2">{num(m.horas_transcurridas, 1)}</td>
              <td className="whitespace-nowrap px-3 py-2">
                <Semaforo estado={m.estado_48h} />
              </td>
              <td className="whitespace-nowrap px-3 py-2">{m.ensayos.length}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs">
                {m.investigadores.length ? m.investigadores.join(", ") : "—"}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-xs">
                {m.ultimaCorrida ? fechaHora(m.ultimaCorrida) : "—"}
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                <Link
                  href={`/muestras/${m.id_muestra}`}
                  className="inline-flex whitespace-nowrap rounded border border-blue-300 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                >
                  Ver detalle
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablaExploracionResultados({
  filas,
}: {
  filas: Array<{
    ensayo: EnsayoGuardado;
    muestra: Muestra | undefined;
    fraccion: EnsayoGuardado["fracciones"][number] | null;
  }>;
}) {
  if (filas.length === 0) {
    return (
      <p className="rounded border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
        No hay resultados que coincidan con los filtros.
      </p>
    );
  }
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-max w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="whitespace-nowrap px-3 py-2">Muestra</th>
            <th className="whitespace-nowrap px-3 py-2">Código</th>
            <th className="whitespace-nowrap px-3 py-2">Especie</th>
            <th className="whitespace-nowrap px-3 py-2">Ubicación</th>
            <th className="whitespace-nowrap px-3 py-2">Ensayo</th>
            <th className="whitespace-nowrap px-3 py-2">Corrida</th>
            <th className="whitespace-nowrap px-3 py-2">Investigador</th>
            <th className="whitespace-nowrap px-3 py-2">PT g/dL</th>
            <th className="whitespace-nowrap px-3 py-2">A/G</th>
            <th className="whitespace-nowrap px-3 py-2">Fracción</th>
            <th className="whitespace-nowrap px-3 py-2">%</th>
            <th className="whitespace-nowrap px-3 py-2">g/dL</th>
            <th className="whitespace-nowrap px-3 py-2">Área</th>
            <th className="whitespace-nowrap px-3 py-2">Detalle</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, idx) => (
            <tr
              key={`${fila.ensayo.id_ensayo}-${fila.fraccion?.nombre_fraccion ?? "x"}-${idx}`}
              className="border-t border-gray-100"
            >
              <td className="whitespace-nowrap px-3 py-2 text-gray-500">#{fila.ensayo.id_muestra}</td>
              <td className="whitespace-nowrap px-3 py-2 font-medium">
                {fila.muestra?.codigo_animal ?? "—"}
              </td>
              <td className="whitespace-nowrap px-3 py-2">{fila.muestra?.especie ?? "—"}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs">
                {fila.muestra?.localidad_puna ?? "—"}
              </td>
              <td className="whitespace-nowrap px-3 py-2">#{fila.ensayo.id_ensayo}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs">
                {fechaHora(fila.ensayo.fecha_corrida)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-xs">
                {investigadorEnsayo(fila.ensayo)}
              </td>
              <td className="whitespace-nowrap px-3 py-2">{num(fila.ensayo.proteinas_totales_g_dl)}</td>
              {(() => {
                const ag = fila.ensayo.relacion_ag ?? calcularRelacionAG(fila.ensayo.fracciones, fila.ensayo.proteinas_totales_g_dl);
                const evAg = fila.muestra ? evaluarValor(fila.muestra.especie, "A/G", ag) : null;
                const claseAg =
                  evAg?.nivel === "critico"
                    ? "bg-red-100 text-red-900 font-medium"
                    : evAg?.nivel === "alerta"
                      ? "bg-yellow-100 text-yellow-900 font-medium"
                      : "";
                return (
                  <td
                    className={`whitespace-nowrap px-3 py-2 ${claseAg}`}
                    title={evAg && evAg.nivel !== "normal" ? evAg.etiqueta : undefined}
                  >
                    {ag != null ? num(ag) : "—"}
                  </td>
                );
              })()}
              <td className="whitespace-nowrap px-3 py-2 font-medium">
                {fila.fraccion?.nombre_fraccion ?? "—"}
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                {fila.fraccion ? num(fila.fraccion.porcentaje_relativo) : "—"}
              </td>
              {(() => {
                const ev =
                  fila.fraccion && fila.muestra
                    ? evaluarValor(
                        fila.muestra.especie,
                        fila.fraccion.nombre_fraccion,
                        fila.fraccion.concentracion_g_dl,
                      )
                    : null;
                const clase =
                  ev?.nivel === "critico"
                    ? "bg-red-100 text-red-900 font-medium"
                    : ev?.nivel === "alerta"
                      ? "bg-yellow-100 text-yellow-900 font-medium"
                      : "";
                return (
                  <td
                    className={`whitespace-nowrap px-3 py-2 ${clase}`}
                    title={ev && ev.nivel !== "normal" ? ev.etiqueta : undefined}
                  >
                    {fila.fraccion ? num(fila.fraccion.concentracion_g_dl) : "—"}
                  </td>
                );
              })()}
              <td className="whitespace-nowrap px-3 py-2">
                {fila.fraccion ? num(fila.fraccion.area_integrada, 4) : "—"}
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                <Link
                  href={`/muestras/${fila.ensayo.id_muestra}`}
                  className="inline-flex whitespace-nowrap rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Ver
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
