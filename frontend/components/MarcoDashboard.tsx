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
  Users,
  LogOut,
  AlertTriangle,
  ChevronsUpDown,
  HeartPulse,
  Menu,
  type LucideIcon,
} from "lucide-react";

import BotonTema from "./BotonTema";
import { useSesion } from "./ProveedorSesion";
import { useMuestras } from "@/hooks/useMuestras";
import { construirAlertasCriticas } from "@/lib/alertas";
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

export type SeccionNav =
  | "inicio"
  | "muestras"
  | "ensayos"
  | "exploracion"
  | "prioridades"
  | "salud"
  | "admin";

function etiquetaRol(rol?: string | null): string {
  if (rol === "admin") return "Administrador";
  if (rol === "investigador") return "Investigador";
  if (rol === "lectura") return "Solo lectura";
  return rol || "Usuario";
}

function iniciales(nombre?: string | null): string {
  if (!nombre) return "U";
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "U";
}

type Props = {
  activa?: SeccionNav;
  titulo?: string;
  subtitulo?: string;
  children: ReactNode;
};

type ItemMenu = {
  href: string;
  seccion: SeccionNav;
  etiqueta: string;
  /** Nombre corto para la barra inferior del celular. */
  corta: string;
  icono: LucideIcon;
};

const ITEM_INICIO: ItemMenu = {
  href: "/",
  seccion: "inicio",
  etiqueta: "Inicio",
  corta: "Inicio",
  icono: LayoutDashboard,
};
const ITEM_ANALIZAR: ItemMenu = {
  href: "/ensayos/nuevo",
  seccion: "ensayos",
  etiqueta: "Analizar tira",
  corta: "Analizar",
  icono: FlaskConical,
};
const ITEM_URGENTES: ItemMenu = {
  href: "/prioridades",
  seccion: "prioridades",
  etiqueta: "Prioridades",
  corta: "Urgentes",
  icono: Clock,
};
const ITEM_MUESTRAS: ItemMenu = {
  href: "/muestras",
  seccion: "muestras",
  etiqueta: "Campañas y Muestras",
  corta: "Muestras",
  icono: ClipboardList,
};
const ITEM_RESULTADOS: ItemMenu = {
  href: "/exploracion",
  seccion: "exploracion",
  etiqueta: "Resultados",
  corta: "Resultados",
  icono: BarChart3,
};
const ITEM_SALUD: ItemMenu = {
  href: "/salud",
  seccion: "salud",
  etiqueta: "Salud del rebaño",
  corta: "Salud",
  icono: HeartPulse,
};
const ITEM_USUARIOS: ItemMenu = {
  href: "/admin/usuarios",
  seccion: "admin",
  etiqueta: "Usuarios",
  corta: "Usuarios",
  icono: Users,
};

// Barra inferior del celular: lo de todos los días. El resto va en "Más".
const ITEMS_BARRA_CELULAR = [
  ITEM_INICIO,
  ITEM_ANALIZAR,
  ITEM_URGENTES,
  ITEM_MUESTRAS,
];

function MenuUsuario() {
  const { usuario, salir } = useSesion();
  const { isMobile } = useSidebar();

  if (!usuario) return null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={usuario.nombre}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="rounded-lg">
                <AvatarFallback className="rounded-lg bg-emerald-600 text-white font-bold text-xs">
                  {iniciales(usuario.nombre)}
                </AvatarFallback>
                <AvatarBadge className="bg-emerald-500" />
              </Avatar>
              <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-bold text-slate-900">
                  {usuario.nombre}
                </span>
                <span className="truncate text-xs text-slate-500 font-medium">
                  {etiquetaRol(usuario.rol_sistema)}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 text-slate-400 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-60 rounded-xl"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={6}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2.5 px-2 py-2">
                <Avatar className="rounded-lg">
                  <AvatarFallback className="rounded-lg bg-emerald-600 text-white font-bold text-xs">
                    {iniciales(usuario.nombre)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-bold text-slate-900">
                    {usuario.nombre}
                  </span>
                  <span className="truncate text-xs text-slate-500">
                    {usuario.email || etiquetaRol(usuario.rol_sistema)}
                  </span>
                </div>
              </div>
              <div className="mx-2 mb-2 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Sistema conectado
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => void salir()}
              className="text-base text-rose-700 focus:bg-rose-50 focus:text-rose-800"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function BarraCelular({
  activa,
  criticas,
  itemsMas,
}: {
  activa: SeccionNav;
  criticas: number;
  itemsMas: ItemMenu[];
}) {
  const { usuario, salir } = useSesion();
  const [masAbierto, setMasAbierto] = useState(false);
  const masActivo = itemsMas.some((item) => item.seccion === activa);

  return (
    <>
      <nav
        aria-label="Menú principal"
        className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_10px_rgba(0,0,0,0.06)]"
      >
        <ul className="grid grid-cols-5">
          {ITEMS_BARRA_CELULAR.map((item) => {
            const Icono = item.icono;
            const esActiva = activa === item.seccion;
            const esAnalizar = item.seccion === "ensayos";
            const conAlerta = item.seccion === "prioridades" && criticas > 0;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={esActiva ? "page" : undefined}
                  className={`flex h-[4.5rem] flex-col items-center justify-center gap-1 text-[13px] font-semibold ${
                    esActiva ? "text-emerald-800" : "text-slate-600"
                  }`}
                >
                  <span
                    className={`relative flex h-9 w-12 items-center justify-center rounded-full ${
                      esAnalizar
                        ? "bg-emerald-600 text-white"
                        : esActiva
                          ? "bg-emerald-100 text-emerald-800"
                          : ""
                    }`}
                  >
                    <Icono className="h-6 w-6" />
                    {conAlerta && (
                      <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
                        {criticas}
                      </span>
                    )}
                  </span>
                  {item.corta}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMasAbierto(true)}
              className={`flex h-[4.5rem] w-full flex-col items-center justify-center gap-1 text-[13px] font-semibold ${
                masActivo ? "text-emerald-800" : "text-slate-600"
              }`}
            >
              <span
                className={`flex h-9 w-12 items-center justify-center rounded-full ${
                  masActivo ? "bg-emerald-100 text-emerald-800" : ""
                }`}
              >
                <Menu className="h-6 w-6" />
              </span>
              Más
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={masAbierto} onOpenChange={setMasAbierto}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl gap-0 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader>
            <SheetTitle className="text-lg">Más opciones</SheetTitle>
            <SheetDescription className="sr-only">
              Otras secciones del sistema y cierre de sesión
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2 px-4">
            {itemsMas.map((item) => {
              const Icono = item.icono;
              const esActiva = activa === item.seccion;
              return (
                <SheetClose asChild key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex h-12 items-center gap-4 rounded-2xl border px-4 text-base font-semibold ${
                      esActiva
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : "border-slate-200 bg-white text-slate-800"
                    }`}
                  >
                    <Icono className="h-6 w-6 text-emerald-700" />
                    {item.etiqueta}
                  </Link>
                </SheetClose>
              );
            })}

            {usuario && (
              <div className="mt-3 border-t border-slate-200 pt-3">
                <p className="px-1 text-base font-bold text-slate-900 truncate">
                  {usuario.nombre}
                </p>
                <p className="px-1 text-sm text-slate-500">
                  {etiquetaRol(usuario.rol_sistema)}
                </p>
                <button
                  type="button"
                  onClick={() => void salir()}
                  className="mt-3 flex h-12 w-full items-center gap-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-base font-semibold text-rose-800"
                >
                  <LogOut className="h-6 w-6" />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default function MarcoDashboard({
  activa = "inicio",
  titulo,
  subtitulo,
  children,
}: Props) {
  const { usuario } = useSesion();
  const { muestras } = useMuestras();

  const criticas = useMemo(
    () => construirAlertasCriticas(muestras).length,
    [muestras],
  );
  const esAdmin = usuario?.rol_sistema === "admin";
  const itemsMenu = useMemo<ItemMenu[]>(
    () => [
      ITEM_INICIO,
      ITEM_MUESTRAS,
      ITEM_URGENTES,
      ITEM_RESULTADOS,
      ITEM_SALUD,
      ...(esAdmin ? [ITEM_USUARIOS] : []),
    ],
    [esAdmin],
  );
  const itemsMas = useMemo<ItemMenu[]>(
    () => [ITEM_RESULTADOS, ITEM_SALUD, ...(esAdmin ? [ITEM_USUARIOS] : [])],
    [esAdmin],
  );

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-sidebar-border">
        {/* Marca e identidad institucional */}
        <SidebarHeader className="flex-row items-center justify-between gap-1 border-b border-sidebar-border group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3 px-1 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100 p-1.5 transition-all group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:rounded-lg group-data-[collapsible=icon]:p-1">
              <Image
                src="/logo-camelia.png"
                alt="LIMS-BioPuna"
                width={36}
                height={36}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
              <span className="text-lg font-bold tracking-tight text-slate-900 leading-tight">
                LIMS<span className="text-emerald-700">-BioPuna</span>
              </span>
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                FCA · UNJu
              </span>
              <span className="text-xs text-slate-500 font-medium truncate">
                Lab. Biofísico-Químico
              </span>
            </div>
          </Link>
          <SidebarTrigger
            className="size-8 shrink-0 text-slate-500 hover:text-slate-900 [&_svg]:size-[18px]"
            title="Mostrar u ocultar el menú"
          />
        </SidebarHeader>

        <SidebarContent className="overflow-x-hidden">
          {/* Acción principal */}
          <SidebarGroup className="pb-1">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={activa === "ensayos"}
                    size="lg"
                    tooltip={ITEM_ANALIZAR.etiqueta}
                    className="bg-emerald-600 text-[15px] text-white font-semibold shadow-xs hover:bg-emerald-700 hover:text-white active:bg-emerald-800 data-[active=true]:bg-emerald-700 data-[active=true]:text-white group-data-[collapsible=icon]:justify-center [&>svg]:size-5"
                  >
                    <Link href={ITEM_ANALIZAR.href}>
                      <FlaskConical className="text-emerald-100" />
                      <span className="group-data-[collapsible=icon]:hidden">
                        {ITEM_ANALIZAR.etiqueta}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <div className="mx-2 h-px shrink-0 bg-sidebar-border" />

          {/* Navegación principal */}
          <SidebarGroup className="pt-1">
            <SidebarGroupContent>
              <SidebarMenu className="gap-1.5">
                {itemsMenu.map((item) => {
                  const esActiva = activa === item.seccion;
                  const Icono = item.icono;
                  const tieneAlerta =
                    item.seccion === "prioridades" && criticas > 0;

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={esActiva}
                        tooltip={item.etiqueta}
                        className="h-10 text-[15px] font-medium text-slate-700 hover:bg-slate-100 data-[active=true]:bg-emerald-50 data-[active=true]:text-emerald-950 data-[active=true]:font-semibold [&>svg]:size-5"
                      >
                        <Link
                          href={item.href}
                          aria-current={esActiva ? "page" : undefined}
                        >
                          <Icono
                            className={
                              esActiva ? "text-emerald-700" : "text-slate-500"
                            }
                          />
                          <span className="group-data-[collapsible=icon]:hidden">
                            {item.etiqueta}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                      {tieneAlerta && (
                        <>
                          <SidebarMenuBadge className="top-2.5! h-5 bg-red-600 text-white rounded-full px-2">
                            <AlertTriangle className="h-3 w-3" />
                            {criticas}
                          </SidebarMenuBadge>
                          {/* Punto indicador cuando el rail está colapsado (el badge se oculta) */}
                          <span className="pointer-events-none absolute top-0.5 right-0.5 hidden h-2 w-2 rounded-full bg-red-600 ring-2 ring-sidebar group-data-[collapsible=icon]:block" />
                        </>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border p-2">
          <MenuUsuario />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        {/* Título de sección */}
        {titulo && activa !== "inicio" && (
          <div className="bg-white border-b border-slate-200/60 px-4 py-4 sm:px-6 lg:px-8">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
              {titulo}
            </h1>
            {subtitulo && (
              <p className="mt-1 text-xs sm:text-sm text-slate-600">
                {subtitulo}
              </p>
            )}
          </div>
        )}

        {/* En celular se deja lugar para que la barra inferior no tape el contenido */}
        <main className="flex min-w-0 flex-1 flex-col p-4 pb-28 sm:p-6 sm:pb-28 md:pb-6 lg:p-8 [&>*]:min-w-0">
          {children}
        </main>
      </SidebarInset>

      <BarraCelular activa={activa} criticas={criticas} itemsMas={itemsMas} />
      <BotonTema />
    </SidebarProvider>
  );
}
