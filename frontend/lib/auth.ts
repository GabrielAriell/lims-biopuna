// Llamadas de autenticación. El backend hace de intermediario con Supabase
// Auth, así el navegador nunca ve la secret key del proyecto.

import { pedirJson } from "./api";
import { API_URL } from "./config";
import {
  cerrarSesionRemota,
  guardarSesion,
  type Sesion,
  type Usuario,
} from "./sesion";

type SesionSinExpirar = Omit<Sesion, "expira_en">;

const INVITADO_EMAIL_POR_DEFECTO = "invitado@biopuna.test";
const INVITADO_PASSWORD_POR_DEFECTO = "INVITADO_PASSWORD";

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

export async function iniciarSesionInvitado(): Promise<Sesion> {
  const email =
    process.env.NEXT_PUBLIC_INVITADO_EMAIL?.trim() || INVITADO_EMAIL_POR_DEFECTO;
  const password =
    process.env.NEXT_PUBLIC_INVITADO_PASSWORD || INVITADO_PASSWORD_POR_DEFECTO;
  const sesion = await iniciarSesion(email, password);
  if (sesion.usuario.rol_sistema !== "lectura") {
    await cerrarSesionRemota();
    throw new Error(
      "La cuenta de invitado configurada no tiene rol de solo lectura",
    );
  }
  return sesion;
}

export function obtenerPerfil(): Promise<Usuario> {
  return pedirJson<Usuario>(`${API_URL}/auth/me`, { method: "GET" });
}
