"use client";

import Image from "next/image";
import { Eye } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { useSesion } from "@/components/ProveedorSesion";
import { Button } from "@/components/ui/button";
import { iniciarSesion, iniciarSesionInvitado } from "@/lib/auth";

const CAMPO =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30";

export default function PaginaLogin() {
  const router = useRouter();
  const { usuario, cargando, iniciar } = useSesion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState<"credenciales" | "invitado" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  // Si ya hay una sesión válida, no tiene sentido mostrar el login.
  useEffect(() => {
    if (!cargando && usuario) router.replace("/");
  }, [cargando, usuario, router]);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setEnviando("credenciales");
    setError(null);
    try {
      const sesion = await iniciarSesion(email, password);
      iniciar(sesion);
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar sesión");
    } finally {
      setEnviando(null);
    }
  }

  async function entrarComoInvitado() {
    setEnviando("invitado");
    setError(null);
    try {
      const sesion = await iniciarSesionInvitado();
      iniciar(sesion);
      router.replace("/");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo iniciar sesión como invitado",
      );
    } finally {
      setEnviando(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        {/* Panel visual: foto de la Puna bajo velo oscuro */}
        <aside className="relative hidden overflow-hidden lg:flex lg:w-[55%] lg:flex-col lg:justify-between">
          <Image
            src="/puna-jujenia.webp"
            alt="Paisaje de la Puna jujeña"
            fill
            className="object-cover"
            priority
            sizes="55vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/60 to-slate-950/90" />

          {/* Marca institucional */}
          <div className="relative z-10 flex items-center gap-3 p-8 xl:p-12">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-md">
              <Image
                src="/logo-biopuna-redondo.png"
                alt=""
                width={40}
                height={40}
                className="h-9 w-9 object-cover"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold leading-tight tracking-tight text-white">
                LIMS<span className="text-emerald-400">-BioPuna</span>
              </span>
              <span className="text-xs font-medium text-white/70">
                FCA · Universidad Nacional de Jujuy
              </span>
            </div>
          </div>

          {/* Mensaje principal */}
          <div className="relative z-10 p-8 xl:p-12">
            <h1 className="text-5xl font-extrabold tracking-tight text-white xl:text-6xl">
              Sistema LIMS
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-white/85">
              Plataforma digital para la trazabilidad y densitometría óptica de
              perfiles metabólicos en camélidos y ovinos de la Puna.
            </p>
            <p className="mt-8 border-t border-white/15 pt-4 text-xs text-white/60">
              Creado por{" "}
              <span className="font-semibold text-white/80">
                Grupo 1 · TriadTech
              </span>{" "}
              — FI-UNJu
            </p>
          </div>
        </aside>

        {/* Panel del formulario */}
        <section className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
                Iniciá sesión
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Ingresá tus datos para continuar.
              </p>
            </div>

            <form onSubmit={enviar} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                >
                  Correo
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  placeholder="usuario@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={CAMPO}
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-semibold text-slate-700"
                >
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={CAMPO}
                />
              </div>

              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                disabled={enviando !== null}
                className="w-full rounded-lg font-semibold"
              >
                {enviando === "credenciales" ? "Ingresando..." : "Ingresar"}
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                o
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => void entrarComoInvitado()}
              disabled={enviando !== null}
              className="w-full rounded-lg font-semibold text-slate-700"
            >
              <Eye className="h-4 w-4 text-emerald-600" />
              {enviando === "invitado"
                ? "Ingresando como invitado..."
                : "Entrar como invitado"}
            </Button>
            <p className="mt-2.5 text-center text-xs text-slate-500">
              Acceso rápido en modo solo lectura.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
