// Llamadas de autenticación. El backend hace de intermediario con Supabase
// Auth, así el navegador nunca ve la secret key del proyecto.

import { pedirJson } from "./api";
import { API_URL } from "./config";
import { guardarSesion, type Sesion, type Usuario } from "./sesion";

type SesionSinExpirar = Omit<Sesion, "expira_en">;

export async function iniciarSesion(
  email: string,
  password: string,
): Promise<Sesion> {
  const datos = await pedirJson<SesionSinExpirar>(
    `${API_URL}/auth/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    },
    { conSesion: false },
  );
  return guardarSesion(datos);
}

export function obtenerPerfil(): Promise<Usuario> {
  return pedirJson<Usuario>(`${API_URL}/auth/me`, { method: "GET" });
}
