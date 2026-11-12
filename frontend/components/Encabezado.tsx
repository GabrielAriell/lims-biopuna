"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BarChart3,
  ClipboardList,
  Clock,
  FlaskConical,
  LogOut,
  User,
  AlertTriangle,
  Menu,
  X,
} from "lucide-react";

import { construirAlertasCriticas } from "@/lib/alertas";
import { useMuestras } from "@/hooks/useMuestras";
import { useSesion } from "./ProveedorSesion";

type Seccion = "inicio" | "muestras" | "ensayos" | "exploracion" | "prioridades";

type Props = {
  activa?: Seccion;
};

export default function Encabezado({ activa }: Props) {
  const { usuario, salir } = useSesion();
  const { muestras } = useMuestras();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const criticas = useMemo(() => construirAlertasCriticas(muestras).length, [muestras]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        {/* Izquierda: Marca e Identidad Oficial LIMS-BioPuna */}
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-3 transition-opacity hover:opacity-90"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100 p-1.5 shadow-2xs transition-transform group-hover:scale-105">
            <Image
              src="/logo-camelia.png"
              alt="LIMS-BioPuna"
              width={40}
              height={40}
              className="h-full w-full object-contain"
              priority
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-lg font-bold tracking-tight text-slate-900 sm:text-2xl">
                LIMS<span className="text-emerald-700">-BioPuna</span>
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-emerald-800">
                FCA · UNJu
              </span>
            </div>
            <span className="text-[11px] sm:text-xs font-medium text-slate-600">
              Lab. Biofísico-Químico
            </span>
          </div>
        </Link>

        {/* Centro: Navegación Principal de Escritorio (md y superior) */}
        <nav className="hidden md:flex items-center gap-1.5">
          <Link
            href="/exploracion"
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all ${
              activa === "exploracion"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <BarChart3 className={`h-4 w-4 ${activa === "exploracion" ? "text-emerald-700" : "text-slate-500"}`} />
            <span>Exploración</span>
          </Link>

          <Link
            href="/muestras"
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all ${
              activa === "muestras"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <ClipboardList className={`h-4 w-4 ${activa === "muestras" ? "text-emerald-700" : "text-slate-500"}`} />
            <span>Muestras y campañas</span>
          </Link>

          <Link
            href="/prioridades"
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all ${
              activa === "prioridades"
                ? "bg-amber-50 text-amber-900 border border-amber-200/80 shadow-2xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Clock className={`h-4 w-4 ${criticas > 0 ? "text-red-600 animate-pulse" : "text-slate-500"}`} />
            <span>Prioridades</span>
            {criticas > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white shadow-2xs">
                <AlertTriangle className="h-3 w-3" />
                {criticas}
              </span>
            )}
          </Link>

          <Link
            href="/ensayos/nuevo"
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold shadow-xs transition-all ${
              activa === "ensayos"
                ? "bg-emerald-700 text-white shadow-md ring-2 ring-emerald-600/30"
                : "bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-sm"
            }`}
          >
            <FlaskConical className="h-4 w-4 text-emerald-100" />
            <span>Nuevo ensayo</span>
          </Link>
        </nav>

        {/* Derecha: Perfil de Investigador + Botón Menú Móvil */}
        <div className="flex shrink-0 items-center gap-2">
          {usuario && (
            <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-1 pl-2.5 shadow-2xs">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                <User className="h-4 w-4" />
              </div>
              <div className="flex flex-col text-left">
                <span className="max-w-[7rem] truncate text-xs font-bold text-slate-800 sm:max-w-[10rem]">
                  {usuario.nombre}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Investigador</span>
              </div>
              <button
                type="button"
                onClick={() => void salir()}
                title="Cerrar sesión"
                className="ml-1 inline-flex items-center gap-1.5 rounded-xl border border-rose-200/70 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 shadow-2xs transition-colors hover:bg-rose-50 hover:text-rose-800"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Salir</span>
              </button>
            </div>
          )}

          {/* Botón Hamburguesa Móvil (visible solo en < md) */}
          <button
            type="button"
            onClick={() => setMenuAbierto(!menuAbierto)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 md:hidden"
            aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú de navegación"}
          >
            {menuAbierto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Menú Desplegable para Móviles / Celulares */}
      {menuAbierto && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden shadow-lg animate-in slide-in-from-top-2">
          <nav className="flex flex-col gap-2">
            <Link
              href="/ensayos/nuevo"
              onClick={() => setMenuAbierto(false)}
              className="flex items-center justify-between rounded-xl bg-emerald-600 px-4 py-3 text-base font-bold text-white shadow-xs"
            >
              <div className="flex items-center gap-3">
                <FlaskConical className="h-5 w-5" />
                <span>Nuevo ensayo</span>
              </div>
              <span className="text-xs bg-emerald-700/60 rounded-lg px-2 py-0.5">Analizar tira</span>
            </Link>

            <Link
              href="/prioridades"
              onClick={() => setMenuAbierto(false)}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold ${
                activa === "prioridades"
                  ? "bg-amber-50 text-amber-900 border-amber-300"
                  : "border-slate-200 text-slate-700 bg-slate-50/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-amber-700" />
                <span>Prioridades y semáforo 48 hs</span>
              </div>
              {criticas > 0 && (
                <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                  {criticas} críticas
                </span>
              )}
            </Link>

            <Link
              href="/muestras"
              onClick={() => setMenuAbierto(false)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${
                activa === "muestras"
                  ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                  : "border-slate-200 text-slate-700 bg-slate-50/50"
              }`}
            >
              <ClipboardList className="h-5 w-5 text-emerald-700" />
              <span>Muestras y campañas</span>
            </Link>

            <Link
              href="/exploracion"
              onClick={() => setMenuAbierto(false)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${
                activa === "exploracion"
                  ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                  : "border-slate-200 text-slate-700 bg-slate-50/50"
              }`}
            >
              <BarChart3 className="h-5 w-5 text-emerald-700" />
              <span>Exploración y Reportes</span>
            </Link>

            {usuario && (
              <div className="mt-2 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-800">{usuario.nombre}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMenuAbierto(false);
                    void salir();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Salir</span>
                </button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
