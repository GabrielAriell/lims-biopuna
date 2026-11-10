import type { ReactNode } from "react";

import GuardiaSesion from "@/components/GuardiaSesion";

// Cache Components valida navegación instantánea por defecto; estas pantallas
// dependen de sesión/datos del cliente, así que se optan fuera de esa validación.
export const instant = false;

// Todo lo que cuelga de /ensayos requiere sesión iniciada.
export default function LayoutEnsayos({ children }: { children: ReactNode }) {
  return <GuardiaSesion>{children}</GuardiaSesion>;
}
