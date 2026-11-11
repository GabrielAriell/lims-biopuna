import type { ReactNode } from "react";

import GuardiaSesion from "@/components/GuardiaSesion";

export const instant = false;

// Pantalla de prioridades/semáforo: requiere sesión iniciada.
export default function LayoutPrioridades({ children }: { children: ReactNode }) {
  return <GuardiaSesion>{children}</GuardiaSesion>;
}
