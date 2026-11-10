"use client";

import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { useSesion } from "@/components/ProveedorSesion";
import { iniciarSesion } from "@/lib/auth";

const CAMPO =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-gray-900 shadow-sm outline-none placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40";

export default function PaginaLogin() {
  const router = useRouter();
  const { usuario, cargando, iniciar } = useSesion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si ya hay una sesión válida, no tiene sentido mostrar el login.
  useEffect(() => {
    if (!cargando && usuario) router.replace("/");
  }, [cargando, usuario, router]);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const sesion = await iniciarSesion(email, password);
      iniciar(sesion);
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar sesión");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Fondo: imagen a pantalla completa */}
      <Image
        src="/login-fondo.jpg"
        alt="Paisaje de la Puna"
        fill
        className="object-cover"
        priority
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-black/45" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 sm:px-8 lg:justify-between lg:px-16 xl:px-24">
        {/* Texto de bienvenida sobre el fondo (estilo referencia) */}
        <div className="hidden max-w-xl text-white lg:block">
          <div className="mb-6 flex items-center gap-3">
            <Image
              src="/logo-camelia.png"
              alt="Camelia Biotech"
              width={56}
              height={56}
              className="h-14 w-14 rounded-full bg-white/90 object-contain p-1"
            />
            <span className="text-2xl font-semibold">Camelia Biotech</span>
          </div>
          <h1 className="mt-2 text-5xl font-extrabold leading-tight tracking-tight xl:text-6xl">
            BIENVENIDO
          </h1>
          <p className="mt-5 max-w-md text-base text-white/85">
            Accedé al sistema para gestionar campañas, muestras y ensayos.
          </p>
        </div>

        {/* Tarjeta de login */}
        <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/10 px-7 py-9 shadow-2xl backdrop-blur-sm sm:px-9 sm:py-10">
          <div className="mb-7 text-center">
            <div className="mb-3 flex items-center justify-center gap-2 lg:hidden">
              <Image
                src="/logo-camelia.png"
                alt="Camelia Biotech"
                width={40}
                height={40}
                className="h-10 w-10 rounded-full bg-white/80 object-contain p-0.5"
              />
              <span className="font-semibold text-white">Camelia Biotech</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white drop-shadow sm:text-[1.7rem]">
              Iniciá sesión en tu cuenta
            </h2>
            <p className="mt-1 text-sm font-medium text-white/90 drop-shadow-sm">
              Ingresá tus datos para continuar
            </p>
          </div>

          <form onSubmit={enviar} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-semibold text-white drop-shadow-sm">
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
                className="mb-1 block text-sm font-semibold text-white drop-shadow-sm"
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
              <p className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="mt-2 w-full rounded-full bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
