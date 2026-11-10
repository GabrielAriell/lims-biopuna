import GuardiaSesion from "@/components/GuardiaSesion";
import InicioCliente from "./InicioCliente";

export const instant = false;

// Página de inicio: accesos principales y resumen rápido.
export default function Pagina() {
  return (
    <GuardiaSesion>
      <InicioCliente />
    </GuardiaSesion>
  );
}
