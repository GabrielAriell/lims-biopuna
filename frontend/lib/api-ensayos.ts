import { pedirJson } from "./api";
import { API_URL } from "./config";
import type { EnsayoGuardado, NuevoEnsayo } from "./tipos-ensayos";

export function listarEnsayos(idMuestra?: number): Promise<EnsayoGuardado[]> {
  const consulta = idMuestra ? `?id_muestra=${idMuestra}` : "";
  return pedirJson<EnsayoGuardado[]>(`${API_URL}/ensayos${consulta}`, {
    method: "GET",
  });
}

// La imagen viaja como archivo y los datos como JSON dentro del mismo
// formulario. La subida a Cloudinary la hace el backend.
export function guardarEnsayo(
  datos: NuevoEnsayo,
  imagen: Blob,
  nombreImagen = "tira.jpg",
): Promise<EnsayoGuardado> {
  const cuerpo = new FormData();
  cuerpo.append("datos", JSON.stringify(datos));
  cuerpo.append("imagen", imagen, nombreImagen);

  return pedirJson<EnsayoGuardado>(`${API_URL}/ensayos`, {
    method: "POST",
    body: cuerpo,
  });
}
