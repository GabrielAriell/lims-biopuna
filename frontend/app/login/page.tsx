"use client";

import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { useSesion } from "@/components/ProveedorSesion";
import { iniciarSesion } from "@/lib/auth";

const CAMPO =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";

// Cuentas creadas por backend/scripts/crear_usuarios_prueba.py.
// Se muestran solo para probar el flujo mientras no hay registro público.
const CLAVE_PRUEBA = "BioPuna2026!";
const CUENTAS_PRUEBA = [
  {
    email: "investigador.uno@biopuna.test",
    nombre: "Investigador Uno",
    rol: "investigador",
  },
  {
    email: "investigadora.dos@biopuna.test",
    nombre: "Investigadora Dos",
    rol: "investigador",
  },
  {
    email: "lectura@biopuna.test",
    nombre: "Usuario de Lectura",
    rol: "lectura",
  },
];

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

  function usarCuenta(cuenta: (typeof CUENTAS_PRUEBA)[number]) {
    setEmail(cuenta.email);
    setPassword(CLAVE_PRUEBA);
    setError(null);
  }

  return (
    <main className="min-h-screen bg-white text-gray-900 lg:flex">
      {/* Panel izquierdo: imagen de la Puna */}
      <section className="relative hidden lg:flex lg:w-1/2 xl:w-[55%]">
        <Image
          src="/login-puna.png"
          alt="Paisaje de la Puna"
          fill
          className="object-cover"
          priority
          sizes="(min-width: 1280px) 55vw, 50vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/10" />
        <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white">
          <div className="flex items-center gap-3">
            <Image
              src="/logo-camelia.png"
              alt="Camelia Biotech"
              width={48}
              height={48}
              className="h-12 w-12 rounded-full bg-white/90 object-contain p-1"
            />
            <span className="text-xl font-semibold">Camelia Biotech</span>
          </div>
          <div className="max-w-md pb-6">
            <h1 className="text-3xl font-bold leading-tight xl:text-4xl">
              Gestión y trazabilidad de muestras
            </h1>
            <p className="mt-3 text-base text-white/90">
              Accedé al sistema para registrar campañas, muestras y ensayos.
            </p>
          </div>
        </div>
      </section>

      {/* Panel derecho: formulario de login */}
      <section className="flex min-h-screen w-full items-center justify-center px-4 py-10 sm:px-8 lg:w-1/2 xl:w-[45%]">
        <div className="w-full max-w-md space-y-6">
          {/* Encabezado visible en móvil (donde no se ve el panel de imagen) */}
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="mb-4 flex items-center gap-3 lg:hidden">
              <Image
                src="/logo-camelia.png"
                alt="Camelia Biotech"
                width={56}
                height={56}
                className="h-14 w-14 object-contain"
                priority
              />
              <span className="text-xl font-bold text-gray-900">Camelia Biotech</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              Iniciar sesión
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Ingresá con tu cuenta para acceder al sistema.
            </p>
          </div>

          <form onSubmit={enviar} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
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
                className="mb-1 block text-sm font-medium text-gray-700"
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
              className="w-full rounded-md bg-emerald-700 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? "Ingresando..." : "Ingresar"}
            </button>
          </form>

          <section className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
            <p className="font-medium">Cuentas de prueba</p>
            <p className="mt-1 text-gray-600">
              Contraseña común: <code className="font-mono">{CLAVE_PRUEBA}</code>
            </p>
            <ul className="mt-2 space-y-1.5">
              {CUENTAS_PRUEBA.map((cuenta) => (
                <li
                  key={cuenta.email}
                  className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2"
                >
                  <span className="break-all text-gray-700">
                    <span className="font-mono">{cuenta.email}</span> ·{" "}
                    {cuenta.nombre} ({cuenta.rol})
                  </span>
                  <button
                    type="button"
                    onClick={() => usarCuenta(cuenta)}
                    className="self-start rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Usar
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>
    </main>
  );
}
