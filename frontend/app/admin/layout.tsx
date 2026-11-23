import type { ReactNode } from "react";

import GuardiaAdmin from "@/components/GuardiaAdmin";
import GuardiaSesion from "@/components/GuardiaSesion";

export const instant = false;

// Administración de usuarios: requiere sesión y rol administrador.
export default function LayoutAdmin({ children }: { children: ReactNode }) {
  return (
    <GuardiaSesion>
      <GuardiaAdmin>{children}</GuardiaAdmin>
    </GuardiaSesion>
  );
}
