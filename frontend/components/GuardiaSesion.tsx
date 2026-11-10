"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useSesion } from "./ProveedorSesion";

// Envuelve las pantallas que requieren login. Mientras se valida la sesión
// no renderiza los hijos, así no se disparan pedidos sin token.
export default function GuardiaSesion({ children }: { children: ReactNode }) {
  const { usuario, cargando } = useSesion();
  const router = useRouter();

  useEffect(() => {
    if (!cargando && !usuario) router.replace("/login");
  }, [cargando, usuario, router]);

  if (cargando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Verificando sesión...</p>
      </main>
    );
  }

  if (!usuario) return null;
  return <>{children}</>;
}
