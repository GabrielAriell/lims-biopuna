import { redirect } from "next/navigation";

// redirect() interrumpe el render; se opta fuera de la validación instantánea.
export const instant = false;

// El análisis de tiras vive dentro de "Nuevo ensayo": así se analiza la imagen
// y, si hay una muestra elegida, se puede guardar el resultado en el mismo
// lugar. La antigua portada de "análisis libre" ya no existe.
export default function Pagina() {
  redirect("/ensayos/nuevo");
}
