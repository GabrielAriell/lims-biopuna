import { pedirJson } from "./api";
import { API_URL } from "./config";
import type {
  ActualizacionUsuarioAdmin,
  NuevoUsuarioAdmin,
  UsuarioAdmin,
} from "./tipos-usuarios";

export function listarUsuariosAdmin(): Promise<UsuarioAdmin[]> {
  return pedirJson<UsuarioAdmin[]>(`${API_URL}/admin/usuarios`, {
    method: "GET",
  });
}

export function crearUsuarioAdmin(
  datos: NuevoUsuarioAdmin,
): Promise<UsuarioAdmin> {
  return pedirJson<UsuarioAdmin>(`${API_URL}/admin/usuarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
}

export function actualizarUsuarioAdmin(
  idUsuario: string,
  datos: ActualizacionUsuarioAdmin,
): Promise<UsuarioAdmin> {
  return pedirJson<UsuarioAdmin>(`${API_URL}/admin/usuarios/${idUsuario}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
}
