"use client";

import { Moon, Sun } from "lucide-react";

const CLAVE = "lims-tema";

// El tema vive en la clase "dark" de <html>: el botón solo la alterna y la
// muestra del ícono es por CSS (dark:hidden / dark:block), así el servidor y
// el cliente renderizan lo mismo sin estados ni hidratación especial.
export default function BotonTema() {
  function alternar() {
    const oscuro = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", oscuro);
    try {
      localStorage.setItem(CLAVE, oscuro ? "oscuro" : "claro");
    } catch {
      // Sin almacenamiento disponible: el cambio dura solo esta sesión.
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label="Cambiar entre modo día y modo noche"
      title="Modo día / modo noche"
      className="fixed right-3 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white/90 text-[#1e293b] shadow-md backdrop-blur transition-colors hover:bg-[#f1f5f9] sm:right-4 sm:top-4"
    >
      <Moon className="h-5 w-5 dark:hidden" />
      <Sun className="hidden h-5 w-5 dark:block" />
    </button>
  );
}
