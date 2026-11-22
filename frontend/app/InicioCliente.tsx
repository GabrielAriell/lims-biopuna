"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import {
  Activity,
  FlaskConical,
  ClipboardPlus,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";

import MarcoDashboard from "@/components/MarcoDashboard";
import { useSesion } from "@/components/ProveedorSesion";
import {
  construirAlertasCriticas,
  construirAlertas,
  textoAlerta,
  type NivelAlerta,
} from "@/lib/alertas";
import { useMuestras } from "@/hooks/useMuestras";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Tarea = {
  href: string;
  titulo: string;
  descripcion: string;
  icono: LucideIcon;
  destacada?: boolean;
};

const TAREAS: Tarea[] = [
  {
    href: "/ensayos/nuevo",
    titulo: "Analizar una tira",
    descripcion: "Subí la foto o el escaneo de la tira y obtené el resultado.",
    icono: FlaskConical,
    destacada: true,
  },
  {
    href: "/muestras",
    titulo: "Registrar muestras",
    descripcion: "Anotá los animales de una salida al campo.",
    icono: ClipboardPlus,
  },
];

const ESTILO_NIVEL: Record<NivelAlerta, { punto: string; texto: string }> = {
  vencida: { punto: "bg-red-600", texto: "text-red-700" },
  por_vencer: { punto: "bg-red-600", texto: "text-red-700" },
  atencion: { punto: "bg-amber-500", texto: "text-amber-700" },
};

const ENLACE_TARJETA =
  "shrink-0 rounded text-sm font-semibold text-emerald-700 hover:text-emerald-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50";

function Contador({
  etiqueta,
  valor,
  clase,
  icono,
}: {
  etiqueta: string;
  valor: number;
  clase: string;
  icono: ReactNode;
}) {
  return (
    <li
      className={`flex items-center justify-between rounded-xl border px-3.5 py-3 ${clase}`}
    >
      <span className="flex items-center gap-3 text-[15px] font-medium">
        {icono}
        {etiqueta}
      </span>
      <span className="text-lg font-semibold tabular-nums">{valor}</span>
    </li>
  );
}

export default function InicioCliente() {
  const { muestras } = useMuestras();
  const { usuario } = useSesion();

  const criticas = useMemo(() => construirAlertasCriticas(muestras), [muestras]);
  const pendientes = useMemo(() => construirAlertas(muestras), [muestras]);

  // Conteos por estado del semáforo biológico
  const conteos = useMemo(() => {
    const contar = (estado: string) =>
      muestras.filter((m) => m.estado_48h === estado).length;
    return {
      verde: contar("verde"),
      amarillo: contar("amarillo"),
      rojo: contar("rojo"),
      procesada: contar("procesada"),
    };
  }, [muestras]);

  const nombre = usuario?.nombre?.trim().split(/\s+/)[0];

  return (
    <MarcoDashboard activa="inicio" titulo="Inicio">
      <div className="mx-auto my-auto w-full max-w-6xl space-y-6">
        {/* Saludo y tareas principales */}
        <section className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/70 p-5 shadow-xs sm:p-7">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {nombre ? `Hola, ${nombre}` : "Hola"}
          </h1>
          <p className="mt-1 text-base text-slate-600">¿Qué querés hacer hoy?</p>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            {TAREAS.map((tarea) => {
              const Icono = tarea.icono;
              return (
                <Link
                  key={tarea.href}
                  href={tarea.href}
                  className={`group flex items-center gap-4 rounded-xl border p-4 shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/40 sm:p-5 ${
                    tarea.destacada
                      ? "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800"
                      : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40"
                  }`}
                >
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${
                      tarea.destacada
                        ? "bg-white/15 text-white"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    <Icono className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-lg font-semibold ${
                        tarea.destacada ? "text-white" : "text-slate-900"
                      }`}
                    >
                      {tarea.titulo}
                    </span>
                    <span
                      className={`mt-0.5 block text-sm leading-snug ${
                        tarea.destacada ? "text-emerald-50" : "text-slate-600"
                      }`}
                    >
                      {tarea.descripcion}
                    </span>
                  </span>
                  <ArrowRight
                    className={`h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1 ${
                      tarea.destacada ? "text-white" : "text-emerald-700"
                    }`}
                  />
                </Link>
              );
            })}
          </div>
        </section>

        {/* Aviso de muestras cerca del límite de 48 h */}
        {criticas.length > 0 && (
          <div
            role="alert"
            className="flex flex-col gap-4 rounded-xl border border-red-200 border-l-4 border-l-red-600 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-red-600" />
              <div>
                <h2 className="text-base font-semibold text-red-950">
                  {criticas.length === 1
                    ? "Hay 1 muestra urgente"
                    : `Hay ${criticas.length} muestras urgentes`}
                </h2>
                <p className="text-sm text-red-900">
                  Están por cumplir las 48 horas. Conviene analizarlas cuanto
                  antes.
                </p>
              </div>
            </div>
            <Button
              asChild
              className="h-10 shrink-0 bg-red-600 px-4 text-sm font-semibold hover:bg-red-700"
            >
              <Link href="/prioridades">
                Ver urgentes
                <ArrowRight />
              </Link>
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Estado de muestras (48h) */}
          <Card className="gap-4 shadow-xs">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Activity className="h-5 w-5 text-emerald-700" />
                  Estado de muestras (48h)
                </CardTitle>
                <Link href="/prioridades" className={ENLACE_TARJETA}>
                  Ver detalle →
                </Link>
              </div>
              <CardDescription className="text-sm">
                Tiempo desde la extracción (límite: 48 horas).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                <Contador
                  etiqueta="A tiempo (menos de 24 h)"
                  valor={conteos.verde}
                  clase="border-emerald-100 bg-emerald-50 text-emerald-800"
                  icono={
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                  }
                />
                <Contador
                  etiqueta="Atención (24 a 40 h)"
                  valor={conteos.amarillo}
                  clase="border-amber-100 bg-amber-50 text-amber-800"
                  icono={
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
                  }
                />
                <Contador
                  etiqueta="Urgentes (más de 40 h)"
                  valor={conteos.rojo}
                  clase="border-red-100 bg-red-50 text-red-800"
                  icono={
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
                  }
                />
                <Contador
                  etiqueta="Completadas"
                  valor={conteos.procesada}
                  clase="border-slate-200 bg-slate-50 text-slate-600"
                  icono={<CheckCircle2 className="h-4 w-4 shrink-0 text-slate-400" />}
                />
              </ul>
            </CardContent>
            <CardFooter className="mt-auto">
              <Button
                asChild
                className="h-10 w-full bg-slate-100 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                <Link href="/prioridades">
                  Ver prioridades
                  <ArrowRight />
                </Link>
              </Button>
            </CardFooter>
          </Card>

          {/* Trabajo pendiente */}
          <Card className="gap-4 shadow-xs lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg">Trabajo pendiente</CardTitle>
                <Link href="/muestras" className={ENLACE_TARJETA}>
                  Ver todas →
                </Link>
              </div>
              <CardDescription className="text-sm">
                Las muestras con menos tiempo aparecen primero.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendientes.length > 0 ? (
                <ul className="max-h-[17rem] space-y-3 overflow-y-auto pr-2">
                  {pendientes.map((alerta) => {
                    const m = alerta.muestra;
                    const estilo = ESTILO_NIVEL[alerta.nivel];
                    return (
                      <li
                        key={alerta.clave}
                        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-slate-900">
                            {m.codigo_animal}
                            <span className="font-normal text-slate-600">
                              {" "}
                              · {m.especie}
                            </span>
                          </p>
                          <p className="truncate text-sm text-slate-500">
                            {m.localidad_puna || "Puna jujeña"}
                          </p>
                          <p
                            className={`mt-1.5 flex items-center gap-2 text-sm font-medium ${estilo.texto}`}
                          >
                            <span
                              className={`h-2.5 w-2.5 shrink-0 rounded-full ${estilo.punto}`}
                            />
                            {textoAlerta(alerta)}
                          </p>
                        </div>
                        <Button
                          asChild
                          className="h-10 shrink-0 bg-emerald-600 px-4 text-sm font-semibold hover:bg-emerald-700"
                        >
                          <Link href={`/ensayos/nuevo?muestra=${m.id_muestra}`}>
                            Analizar
                            <ArrowRight />
                          </Link>
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="space-y-1.5 py-8 text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                  <p className="text-base font-semibold text-slate-800">
                    No hay muestras apuradas
                  </p>
                  <p className="text-sm text-slate-600">
                    Todas fueron analizadas o todavía tienen tiempo.
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 text-sm text-slate-600 [.border-t]:pt-4">
              <span>
                Total de muestras:{" "}
                <strong className="font-semibold text-slate-900">
                  {muestras.length}
                </strong>
              </span>
              <Link href="/ensayos/nuevo" className={ENLACE_TARJETA}>
                + Analizar tira sin muestra
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    </MarcoDashboard>
  );
}
