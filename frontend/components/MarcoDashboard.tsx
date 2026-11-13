"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  FlaskConical,
  Clock,
  ClipboardList,
  BarChart3,
  User,
  LogOut,
  AlertTriangle,
  Menu,
  X,
  Search,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

import { useSesion } from "./ProveedorSesion";
import { useMuestras } from "@/hooks/useMuestras";
import { construirAlertasCriticas } from "@/lib/alertas";

export type SeccionNav = "inicio" | "muestras" | "ensayos" | "exploracion" | "prioridades";

type Props = {
  activa?: SeccionNav;
  titulo?: string;
  subtitulo?: string;
  children: ReactNode;
};

const ITEMS_MENU = [
  {
    href: "/",
    seccion: "inicio" as SeccionNav,
    etiqueta: "Inicio",
    icono: LayoutDashboard,
  },
  {
    href: "/prioridades",
    seccion: "prioridades" as SeccionNav,
    etiqueta: "Prioridades (48h)",
    icono: Clock,
  },
  {
    href: "/muestras",
    seccion: "muestras" as SeccionNav,
    etiqueta: "Muestras y Campañas",
    icono: ClipboardList,
  },
  {
    href: "/exploracion",
    seccion: "exploracion" as SeccionNav,
    etiqueta: "Reportes y Datos",
    icono: BarChart3,
  },
] as const;

export default function MarcoDashboard({
  activa = "inicio",
  titulo,
  subtitulo,
  children,
}: Props) {
  const { usuario, salir } = useSesion();
  const { muestras } = useMuestras();
  const [menuMovil, setMenuMovil] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const criticas = useMemo(() => construirAlertasCriticas(muestras).length, [muestras]);

  function ejecutarBusqueda(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && busqueda.trim()) {
      window.location.href = `/exploracion?q=${encodeURIComponent(busqueda.trim())}`;
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* ─────────────────────────────────────────────────────────────
          1. BARRA LATERAL FIJA (SIDEBAR DE ESTACIÓN DE TRABAJO)
          ───────────────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex lg:w-64 xl:w-72 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200/90 z-40 shadow-xs">
        {/* Cabecera Sidebar: Marca e Identidad Institucional */}
        <div className="p-5 border-b border-slate-100 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100 p-1.5 shadow-2xs">
            <Image
              src="/logo-camelia.png"
              alt="LIMS-BioPuna"
              width={40}
              height={40}
              className="h-full w-full object-contain"
              priority
            />
          </div>
          <div className="flex flex-col min-w-0">
            <Link href="/" className="flex items-center gap-1.5 hover:opacity-90">
              <span className="text-xl font-black tracking-tight text-slate-900">
                LIMS<span className="text-emerald-700">-BioPuna</span>
              </span>
            </Link>
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
              FCA · UNJu
            </span>
            <span className="text-[11px] text-slate-500 font-medium truncate">
              Lab. Biofísico-Químico
            </span>
          </div>
        </div>

        {/* Botón de Acción Principal Directo (Nuevo Ensayo) */}
        <div className="p-3 border-b border-slate-100">
          <Link
            href="/ensayos/nuevo"
            className={`flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-sm font-bold shadow-xs transition-all ${
              activa === "ensayos"
                ? "bg-emerald-700 text-white shadow-md ring-2 ring-emerald-600/30"
                : "bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-sm"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FlaskConical className="h-4 w-4 text-emerald-100" />
              <span>+ Nuevo Ensayo</span>
            </div>
            <span className="bg-emerald-800/60 text-[10px] font-extrabold px-2 py-0.5 rounded-md">
              Nuevo
            </span>
          </Link>
        </div>

        {/* Navegación Principal */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Menú
          </span>

          {ITEMS_MENU.map((item) => {
            const esActiva = activa === item.seccion;
            const Icono = item.icono;
            const tieneAlerta = item.seccion === "prioridades" && criticas > 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  esActiva
                    ? "bg-emerald-50 text-emerald-950 font-bold border border-emerald-200/80 shadow-2xs"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icono
                    className={`h-4 w-4 ${
                      esActiva ? "text-emerald-700" : "text-slate-500"
                    }`}
                  />
                  <span>{item.etiqueta}</span>
                </div>

                {tieneAlerta && (
                  <span className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-extrabold text-white animate-pulse shadow-2xs">
                    <AlertTriangle className="h-3 w-3" />
                    {criticas}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Pie de Barra Lateral: Estado de Nube y Perfil de Investigador */}
        <div className="p-3 border-t border-slate-100 space-y-2.5">
          {/* Indicador de Estado Operativo */}
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-1.5 border border-slate-200/60 text-[11px] font-medium text-slate-600">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="truncate">Sistema conectado</span>
          </div>

          {/* Tarjeta de Usuario */}
          {usuario && (
            <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                  <User className="h-4 w-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="truncate text-xs font-bold text-slate-900">
                    {usuario.nombre}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium truncate">
                    Investigador
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void salir()}
                title="Cerrar sesión"
                className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-rose-200/80 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
                aria-label="Cerrar sesión"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          2. CABECERA MÓVIL (VISIBLE SOLO EN CELULARES Y TABLETS)
          ───────────────────────────────────────────────────────────── */}
      <header className="lg:hidden sticky top-0 z-50 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-xs">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo-camelia.png"
            alt="LIMS-BioPuna"
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
          />
          <div className="flex flex-col">
            <span className="text-base font-black tracking-tight text-slate-900 leading-tight">
              LIMS<span className="text-emerald-700">-BioPuna</span>
            </span>
            <span className="text-[9px] font-semibold text-emerald-800 uppercase">
              FCA · UNJu
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {criticas > 0 && (
            <Link
              href="/prioridades"
              className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white shadow-xs"
            >
              <AlertTriangle className="h-3 w-3" />
              <span>{criticas}</span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => setMenuMovil(!menuMovil)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            aria-label={menuMovil ? "Cerrar menú" : "Abrir menú de navegación"}
          >
            {menuMovil ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Menú Desplegable Móvil */}
      {menuMovil && (
        <div className="lg:hidden fixed inset-x-0 top-[57px] bottom-0 z-40 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border-b border-slate-200 p-4 space-y-2 shadow-xl animate-in slide-in-from-top-2">
            <Link
              href="/ensayos/nuevo"
              onClick={() => setMenuMovil(false)}
              className="flex items-center justify-between rounded-xl bg-emerald-600 px-4 py-3 text-white font-bold text-sm shadow-xs"
            >
              <div className="flex items-center gap-2.5">
                <FlaskConical className="h-4 w-4" />
                <span>+ Nuevo Ensayo</span>
              </div>
              <ChevronRight className="h-4 w-4" />
            </Link>

            {ITEMS_MENU.map((item) => {
              const esActiva = activa === item.seccion;
              const Icono = item.icono;
              const tieneAlerta = item.seccion === "prioridades" && criticas > 0;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuMovil(false)}
                  className={`flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm font-semibold ${
                    esActiva
                      ? "bg-emerald-50 text-emerald-900 border-emerald-300 font-bold"
                      : "border-slate-200 text-slate-700 bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icono className="h-4 w-4 text-slate-500" />
                    <span>{item.etiqueta}</span>
                  </div>
                  {tieneAlerta && (
                    <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {criticas} críticas
                    </span>
                  )}
                </Link>
              );
            })}

            {usuario && (
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-800">{usuario.nombre}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMenuMovil(false);
                    void salir();
                  }}
                  className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1"
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. ÁREA DE TRABAJO PRINCIPAL (PANELES Y CONTENIDO)
          ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 lg:pl-64 xl:pl-72 flex flex-col min-h-screen">
        {/* Barra Superior de Escritorio */}
        <header className="hidden lg:flex items-center justify-between border-b border-slate-200/90 bg-white/95 backdrop-blur-md px-8 py-3.5 sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-2 text-xs">
            <Link
              href="/"
              className="font-medium text-slate-400 hover:text-slate-600 transition-colors"
            >
              LIMS-BioPuna
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <span className="font-bold text-slate-800">
              {titulo || (activa === "inicio" ? "Inicio" : activa)}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Buscador Rápido de Muestras */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar animal o muestra..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={ejecutarBusqueda}
                className="w-64 rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none transition-all shadow-2xs"
              />
            </div>

            {activa !== "ensayos" && (
              <Link
                href="/ensayos/nuevo"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition"
              >
                <FlaskConical className="h-3.5 w-3.5" />
                <span>+ Nuevo Ensayo</span>
              </Link>
            )}
          </div>
        </header>

        {/* Título de sección (si se proporciona) */}
        {titulo && activa !== "inicio" && (
          <div className="bg-white border-b border-slate-200/60 px-4 py-4 sm:px-6 lg:px-8">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
              {titulo}
            </h1>
            {subtitulo && (
              <p className="mt-1 text-xs sm:text-sm text-slate-600">{subtitulo}</p>
            )}
          </div>
        )}

        {/* Contenido Inyectado */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

