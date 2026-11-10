import PaginaMuestrasCliente from "./PaginaMuestrasCliente";

// Esta pantalla depende de sesión/datos del cliente. Se opta fuera de la
// validación de navegación instantánea (Cache Components); "instant" no puede
// exportarse desde un Client Component, por eso el page es server y delega.
export const instant = false;

export default function PaginaMuestras() {
  return <PaginaMuestrasCliente />;
}
