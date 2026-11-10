"use client";

import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import AnalisisTira from "@/components/AnalisisTira";
import { useSesion } from "@/components/ProveedorSesion";
import { iniciarSesion } from "@/lib/auth";

const CAMPO =
  "w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900";

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
  const [loginAbierto, setLoginAbierto] = useState(true);

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
    <main className="relative min-h-screen bg-gray-50 text-gray-900 lg:flex">
      {/* Área principal: branding + análisis libre */}
      <section className="flex-1 px-4 py-8 sm:px-8 lg:py-10">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-b from-white to-emerald-50/40 px-6 py-10 text-center shadow-sm">
            <Image
              src="/logo-camelia.png"
              alt="Camelia Biotech"
              width={140}
              height={140}
              className="mx-auto h-28 w-28 object-contain sm:h-36 sm:w-36"
              priority
            />
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Camelia Biotech
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-base text-gray-600 sm:text-lg">
              Análisis libre de tiras: cargá una imagen, ajustá los límites y
              descargá los resultados en CSV, Excel o PDF, sin necesidad de
              iniciar sesión.
            </p>
          </div>

          <section className="rounded-lg border border-emerald-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Análisis libre
              </h2>
              <p className="text-sm text-gray-600">
                Este análisis no se guarda en el sistema. Si querés registrar
                campañas, muestras y ensayos, iniciá sesión.
              </p>
            </div>
            <AnalisisTira publico />
          </section>
        </div>
      </section>

      {/* Panel de login (plegable) */}
      <aside
        className={`relative z-10 border-t border-gray-200 bg-white shadow-sm transition-all duration-300 lg:border-l lg:border-t-0 ${
          loginAbierto
            ? "w-full lg:w-[420px] lg:min-w-[420px]"
            : "w-full lg:w-0 lg:min-w-0 lg:overflow-hidden lg:border-l-0"
        }`}
      >
        <div
          className={`h-full ${
            loginAbierto ? "block" : "hidden lg:block lg:invisible lg:opacity-0"
          }`}
        >
          <div className="flex h-full flex-col p-6 sm:p-8 lg:overflow-y-auto">
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Iniciar sesión</h2>
                <p className="text-sm text-gray-500">
                  Accedé al sistema para gestionar campañas, muestras y ensayos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLoginAbierto(false)}
                className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                aria-label="Ocultar panel de inicio de sesión"
                title="Ocultar"
              >
                Ocultar
              </button>
            </div>

            <form onSubmit={enviar} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium">
                  Correo
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={CAMPO}
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1 block text-sm font-medium"
                >
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
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
                className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enviando ? "Ingresando..." : "Ingresar"}
              </button>
            </form>

            <section className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <p className="font-medium">Cuentas de prueba</p>
              <p className="mt-1 text-blue-800">
                Contraseña común: <code className="font-mono">{CLAVE_PRUEBA}</code>
              </p>
              <ul className="mt-2 space-y-1">
                {CUENTAS_PRUEBA.map((cuenta) => (
                  <li
                    key={cuenta.email}
                    className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2"
                  >
                    <span className="break-all">
                      <span className="font-mono">{cuenta.email}</span> ·{" "}
                      {cuenta.nombre} ({cuenta.rol})
                    </span>
                    <button
                      type="button"
                      onClick={() => usarCuenta(cuenta)}
                      className="self-start rounded border border-blue-300 bg-white px-2 py-0.5 text-xs font-medium text-blue-800 hover:bg-blue-100"
                    >
                      Usar
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </aside>

      {/* Pestaña para reabrir login cuando está oculto (escritorio) */}
      {!loginAbierto && (
        <button
          type="button"
          onClick={() => setLoginAbierto(true)}
          className="fixed right-0 top-1/2 z-20 hidden -translate-y-1/2 rounded-l-md bg-blue-600 px-3 py-4 text-sm font-medium text-white shadow hover:bg-blue-700 lg:block"
          aria-label="Mostrar panel de inicio de sesión"
        >
          Iniciar sesión
        </button>
      )}

      {/* Botón para mostrar login en móvil cuando está oculto */}
      {!loginAbierto && (
        <div className="fixed bottom-4 right-4 z-20 lg:hidden">
          <button
            type="button"
            onClick={() => setLoginAbierto(true)}
            className="rounded-full bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-blue-700"
          >
            Iniciar sesión
          </button>
        </div>
      )}
    </main>
  );
}
