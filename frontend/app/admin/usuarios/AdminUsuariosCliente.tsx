"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, Shield, UserPlus, X } from "lucide-react";

import MarcoDashboard from "@/components/MarcoDashboard";
import { useSesion } from "@/components/ProveedorSesion";
import {
  actualizarUsuarioAdmin,
  crearUsuarioAdmin,
  listarUsuariosAdmin,
} from "@/lib/api-usuarios";
import type { RolSistema, UsuarioAdmin } from "@/lib/tipos-usuarios";

const ROLES: { valor: RolSistema; etiqueta: string }[] = [
  { valor: "admin", etiqueta: "Administrador" },
  { valor: "investigador", etiqueta: "Investigador" },
  { valor: "lectura", etiqueta: "Solo lectura" },
];

function etiquetaRol(rol: string): string {
  return ROLES.find((r) => r.valor === rol)?.etiqueta ?? rol;
}

type Edicion = {
  nombre: string;
  rol_sistema: RolSistema;
};

export default function AdminUsuariosCliente() {
  const { usuario } = useSesion();
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [creando, setCreando] = useState(false);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState({
    nombre: "",
    email: "",
    password: "",
    rol_sistema: "investigador" as RolSistema,
  });
  const [ediciones, setEdiciones] = useState<Record<string, Edicion>>({});

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const datos = await listarUsuariosAdmin();
      setUsuarios(datos);
      const mapa: Record<string, Edicion> = {};
      for (const u of datos) {
        mapa[u.id_investigador] = {
          nombre: u.nombre,
          rol_sistema: (u.rol_sistema as RolSistema) || "lectura",
        };
      }
      setEdiciones(mapa);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar los usuarios");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  const totalAdmins = useMemo(
    () => usuarios.filter((u) => u.rol_sistema === "admin").length,
    [usuarios],
  );

  async function onCrear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    setCreando(true);
    try {
      const creado = await crearUsuarioAdmin({
        nombre: nuevo.nombre.trim(),
        email: nuevo.email.trim(),
        password: nuevo.password,
        rol_sistema: nuevo.rol_sistema,
      });
      setUsuarios((prev) => [...prev, creado].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
      setEdiciones((prev) => ({
        ...prev,
        [creado.id_investigador]: {
          nombre: creado.nombre,
          rol_sistema: (creado.rol_sistema as RolSistema) || "lectura",
        },
      }));
      setNuevo({ nombre: "", email: "", password: "", rol_sistema: "investigador" });
      setAviso(`Usuario "${creado.nombre}" creado correctamente.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el usuario");
    } finally {
      setCreando(false);
    }
  }

  function cambiarEdicion(id: string, parche: Partial<Edicion>) {
    setEdiciones((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...parche },
    }));
  }

  async function guardarUsuario(u: UsuarioAdmin) {
    const ed = ediciones[u.id_investigador];
    if (!ed) return;
    const nombre = ed.nombre.trim();
    if (!nombre) {
      setError("El nombre no puede estar vacío");
      return;
    }
    setError(null);
    setAviso(null);
    setGuardandoId(u.id_investigador);
    try {
      const actualizado = await actualizarUsuarioAdmin(u.id_investigador, {
        nombre,
        rol_sistema: ed.rol_sistema,
      });
      setUsuarios((prev) =>
        prev.map((x) => (x.id_investigador === actualizado.id_investigador ? actualizado : x)),
      );
      setEdiciones((prev) => ({
        ...prev,
        [actualizado.id_investigador]: {
          nombre: actualizado.nombre,
          rol_sistema: (actualizado.rol_sistema as RolSistema) || "lectura",
        },
      }));
      setAviso(`Usuario "${actualizado.nombre}" actualizado.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar el usuario");
    } finally {
      setGuardandoId(null);
    }
  }

  function hayCambios(u: UsuarioAdmin): boolean {
    const ed = ediciones[u.id_investigador];
    if (!ed) return false;
    return ed.nombre.trim() !== u.nombre || ed.rol_sistema !== u.rol_sistema;
  }

  function restablecer(u: UsuarioAdmin) {
    setEdiciones((prev) => ({
      ...prev,
      [u.id_investigador]: {
        nombre: u.nombre,
        rol_sistema: (u.rol_sistema as RolSistema) || "lectura",
      },
    }));
  }

  return (
    <MarcoDashboard
      activa="admin"
      titulo="Administración de usuarios"
      subtitulo="Gestión de accesos y roles del sistema. Solo los administradores pueden ver y usar esta sección."
    >
      <div className="space-y-6 max-w-6xl">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 shadow-xs">
            {error}
          </div>
        )}
        {aviso && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 shadow-xs">
            {aviso}
          </div>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="h-5 w-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">Crear usuario</h2>
          </div>
          <p className="text-xs text-slate-600 mb-4">
            Se crea la cuenta en Supabase Auth y su perfil con el rol elegido. La contraseña es temporal: definila acá y compartila de forma segura con la persona.
          </p>
          <form onSubmit={onCrear} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">Nombre</span>
              <input
                required
                value={nuevo.nombre}
                onChange={(e) => setNuevo((p) => ({ ...p, nombre: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                placeholder="Nombre y apellido"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">Correo</span>
              <input
                required
                type="email"
                value={nuevo.email}
                onChange={(e) => setNuevo((p) => ({ ...p, email: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                placeholder="correo@ejemplo.com"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-700">Contraseña temporal</span>
              <input
                required
                minLength={8}
                type="password"
                value={nuevo.password}
                onChange={(e) => setNuevo((p) => ({ ...p, password: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                placeholder="Mínimo 8 caracteres"
              />
            </label>
            <div className="flex gap-2 items-end">
              <label className="block flex-1">
                <span className="text-xs font-semibold text-slate-700">Rol</span>
                <select
                  value={nuevo.rol_sistema}
                  onChange={(e) => setNuevo((p) => ({ ...p, rol_sistema: e.target.value as RolSistema }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 bg-white"
                >
                  {ROLES.map((r) => (
                    <option key={r.valor} value={r.valor}>{r.etiqueta}</option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={creando}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-2xs hover:bg-emerald-700 transition disabled:opacity-60"
              >
                {creando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Crear
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900">Usuarios registrados</h2>
            </div>
            <p className="text-xs text-slate-500">
              {usuarios.length} usuario(s) · {totalAdmins} administrador(es)
            </p>
          </div>

          {cargando ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-6">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando usuarios...
            </div>
          ) : usuarios.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">No hay usuarios registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-500 border-b border-slate-200">
                    <th className="py-3 pr-4">Nombre</th>
                    <th className="py-3 pr-4">Correo</th>
                    <th className="py-3 pr-4">Rol</th>
                    <th className="py-3 pr-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => {
                    const ed = ediciones[u.id_investigador];
                    const esYo = usuario?.id === u.id_investigador;
                    const modificado = hayCambios(u);
                    const guardando = guardandoId === u.id_investigador;
                    return (
                      <tr key={u.id_investigador} className="border-b border-slate-100 align-middle">
                        <td className="py-3 pr-4">
                          <input
                            value={ed?.nombre ?? u.nombre}
                            onChange={(e) => cambiarEdicion(u.id_investigador, { nombre: e.target.value })}
                            className="w-full min-w-[180px] rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                          />
                          {esYo && <span className="ml-1 text-[10px] font-bold text-emerald-700">(vos)</span>}
                        </td>
                        <td className="py-3 pr-4 text-slate-700 whitespace-nowrap">{u.email}</td>
                        <td className="py-3 pr-4">
                          <select
                            value={ed?.rol_sistema ?? (u.rol_sistema as RolSistema)}
                            onChange={(e) => cambiarEdicion(u.id_investigador, { rol_sistema: e.target.value as RolSistema })}
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm bg-white focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                          >
                            {ROLES.map((r) => (
                              <option key={r.valor} value={r.valor}>{r.etiqueta}</option>
                            ))}
                          </select>
                          <span className="ml-2 text-xs text-slate-400 hidden sm:inline">{etiquetaRol(u.rol_sistema)}</span>
                        </td>
                        <td className="py-3 pr-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => guardarUsuario(u)}
                              disabled={!modificado || guardando}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-40 transition"
                              title="Guardar cambios"
                            >
                              {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                              Guardar
                            </button>
                            {modificado && !guardando && (
                              <button
                                type="button"
                                onClick={() => restablecer(u)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                title="Descartar cambios"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
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
