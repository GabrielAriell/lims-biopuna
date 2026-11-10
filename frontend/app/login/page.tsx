"use client";

import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

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
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10 text-gray-900">
      <div className="w-full max-w-md space-y-5">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/logo-camelia.png"
            alt="Camelia Biotech"
            width={80}
            height={80}
            className="mb-2 h-20 w-20 object-contain"
            priority
          />
          <h1 className="text-2xl font-bold">Camelia Biotech</h1>
          <p className="mt-1 text-sm text-gray-600">
            Iniciá sesión para acceder al sistema
          </p>
        </div>

        <form
          onSubmit={enviar}
          className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
        >
          <div>
            <h2 className="text-lg font-semibold">Iniciar sesión</h2>
            <p className="text-sm text-gray-500">
              El usuario logueado queda registrado automáticamente como creador
              de cada campaña, muestra y ensayo.
            </p>
          </div>

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

        <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
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
          <p className="mt-2 text-xs text-blue-700">
            Cuentas de prueba para acceder al sistema.
          </p>
        </section>
      </div>
    </main>
  );
}
