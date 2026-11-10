// Sesión del navegador: guarda los tokens de Supabase Auth y los renueva
// cuando están por vencer. La secret key de Supabase nunca pasa por acá.

import { API_URL } from "./config";

export type RolSistema = "admin" | "investigador" | "lectura";

export type Usuario = {
  id: string;
  nombre: string;
  email: string;
  rol_sistema: RolSistema | string;
};

export type Sesion = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  usuario: Usuario;
  // Momento (en ms) a partir del cual conviene renovar el token.
  expira_en: number;
};

const CLAVE = "lims-biopuna.sesion";
// Renovamos un minuto antes de que venza para no fallar en mitad de un guardado.
const MARGEN_MS = 60_000;

// En entorno compartido (varios investigadores en la misma PC) la sesión no
// debe quedar abierta entre personas: se guarda en sessionStorage, que se borra
// al cerrar la pestaña/ventana. "Salir" también la elimina.
const ALMACEN = "session";

function almacenamiento(): Storage | null {
  if (typeof window === "undefined") return null;
  return ALMACEN === "session" ? window.sessionStorage : window.localStorage;
}

export function leerSesion(): Sesion | null {
  const store = almacenamiento();
  if (!store) return null;
  try {
    const crudo = store.getItem(CLAVE);
    if (!crudo) return null;
    const datos = JSON.parse(crudo) as Sesion;
    if (!datos?.access_token || !datos?.refresh_token || !datos?.usuario?.id) {
      return null;
    }
    return datos;
  } catch {
    return null;
  }
}

export function guardarSesion(
  datos: Omit<Sesion, "expira_en"> & { expira_en?: number },
): Sesion {
  const sesion: Sesion = {
    ...datos,
    expira_en:
      datos.expira_en ??
      Date.now() + Math.max(datos.expires_in || 3600, 60) * 1000,
  };
  almacenamiento()?.setItem(CLAVE, JSON.stringify(sesion));
  return sesion;
}

export function borrarSesion(): void {
  almacenamiento()?.removeItem(CLAVE);
}

export function tokenActual(): string | null {
  return leerSesion()?.access_token ?? null;
}

// Una sola renovación a la vez: varias llamadas simultáneas comparten la
// misma promesa para no invalidar el refresh token entre ellas.
let renovando: Promise<Sesion | null> | null = null;

async function renovar(refreshToken: string): Promise<Sesion | null> {
  try {
    const respuesta = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!respuesta.ok) {
      borrarSesion();
      return null;
    }
    const datos = (await respuesta.json()) as Omit<Sesion, "expira_en">;
    return guardarSesion(datos);
  } catch {
    // Si el backend no responde, no borramos la sesión: puede ser un corte
    // temporal y el usuario prefiere reintentar.
    return null;
  }
}

export async function asegurarSesion(): Promise<Sesion | null> {
  const sesion = leerSesion();
  if (!sesion) return null;
  if (Date.now() < sesion.expira_en - MARGEN_MS) return sesion;

  if (!renovando) {
    renovando = renovar(sesion.refresh_token).finally(() => {
      renovando = null;
    });
  }
  return renovando;
}

export async function cerrarSesionRemota(): Promise<void> {
  const sesion = leerSesion();
  if (!sesion) return;
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sesion.access_token}` },
    });
  } catch {
    // Aunque falle la revocación, cerramos la sesión local.
  } finally {
    borrarSesion();
  }
}
