import type { ReactNode } from "react";

import GuardiaSesion from "@/components/GuardiaSesion";

// Exploración usa sesión y datos de cliente; se opta fuera de la validación
// de navegación instantánea de Cache Components.
export const instant = false;

export default function LayoutExploracion({ children }: { children: ReactNode }) {
  return <GuardiaSesion>{children}</GuardiaSesion>;
}
