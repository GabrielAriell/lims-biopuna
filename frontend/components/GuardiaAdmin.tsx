"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useSesion } from "./ProveedorSesion";

// Permite el acceso solo a administradores. Debe usarse dentro de GuardiaSesion.
export default function GuardiaAdmin({ children }: { children: ReactNode }) {
  const { usuario, cargando } = useSesion();
  const router = useRouter();

  useEffect(() => {
    if (!cargando && usuario && usuario.rol_sistema !== "admin") {
      router.replace("/");
    }
  }, [cargando, usuario, router]);

  if (cargando || !usuario) return null;
  if (usuario.rol_sistema !== "admin") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Acceso restringido a administradores.</p>
      </main>
    );
  }
  return <>{children}</>;
}
