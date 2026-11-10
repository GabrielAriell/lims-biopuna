import { API_URL } from "./config";
import { asegurarSesion, borrarSesion, tokenActual } from "./sesion";
import type { AnalisisTira, CalculoLimites, Parametros, Zona } from "./tipos";

function mensajeError(cuerpo: unknown): string | null {
  const detalle = (cuerpo as { detail?: unknown } | null)?.detail;
  if (typeof detalle === "string") return detalle;
  if (Array.isArray(detalle)) {
    const textos = detalle.map((d: { msg?: string }) => d?.msg).filter(Boolean);
    return textos.length ? textos.join("; ") : null;
  }
  return null;
}

function sesionExpirada(): void {
  if (typeof window === "undefined") return;
  // El proveedor de sesión escucha este evento y lleva al login con el
  // router de Next (sin recargar toda la aplicación).
  window.dispatchEvent(new Event("lims:sesion-expirada"));
}

type OpcionesPedido = {
  // El login y el refresco no deben intentar renovar una sesión vieja.
  conSesion?: boolean;
};

export async function pedirJson<T>(
  url: string,
  init: RequestInit,
  opciones: OpcionesPedido = {},
): Promise<T> {
  const conSesion = opciones.conSesion ?? true;
  const habiaSesion = conSesion && Boolean(tokenActual());
  const sesion = conSesion ? await asegurarSesion() : null;

  if (conSesion && habiaSesion && !sesion) {
    sesionExpirada();
    throw new Error("La sesión venció. Volvé a iniciar sesión.");
  }

  const cabeceras = new Headers(init.headers);
  if (sesion && !cabeceras.has("Authorization")) {
    cabeceras.set("Authorization", `Bearer ${sesion.access_token}`);
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(url, { ...init, headers: cabeceras });
  } catch {
    throw new Error("No se pudo conectar con la API. ¿Está corriendo el backend?");
  }
  if (!respuesta.ok) {
    if (respuesta.status === 401 && sesion) {
      borrarSesion();
      sesionExpirada();
    }
    const cuerpo = await respuesta.json().catch(() => null);
    throw new Error(mensajeError(cuerpo) ?? `Error ${respuesta.status}`);
  }
  if (respuesta.status === 204) return undefined as T;
  return respuesta.json() as Promise<T>;
}

function _formAnalisis(archivo: File, p: Parametros, region?: string): FormData {
  const datos = new FormData();
  datos.append("imagen", archivo);
  if (p.proteinasTotales.trim()) {
    datos.append("proteinas_totales", p.proteinasTotales.replace(",", "."));
  }
  datos.append("prominencia", String(p.prominencia));
  datos.append("modo", p.modo);
  if (p.nCarriles.trim()) datos.append("n_carriles", p.nCarriles);
  datos.append("vertical", String(p.vertical));
  datos.append("invertir", String(p.invertir));
  if (region) datos.append("region", region);
  return datos;
}

// region: "x,y,ancho,alto" sobre la imagen ya orientada. Si se omite, la API
// detecta la tira sola.
export async function analizarTira(
  archivo: File,
  p: Parametros,
  region?: string,
): Promise<AnalisisTira> {
  return pedirJson<AnalisisTira>(`${API_URL}/ensayos/analizar-tira`, {
    method: "POST",
    body: _formAnalisis(archivo, p, region),
  });
}

// Análisis libre sin autenticación (no guarda nada).
export async function analizarTiraLibre(
  archivo: File,
  p: Parametros,
  region?: string,
): Promise<AnalisisTira> {
  return pedirJson<AnalisisTira>(
    `${API_URL}/tiras/analizar-libre`,
    { method: "POST", body: _formAnalisis(archivo, p, region) },
    { conSesion: false },
  );
}

// Descarga un archivo (PDF/Excel) usando la sesión autenticada.
export async function descargarArchivoAutenticado(
  url: string,
  nombreFallback: string,
): Promise<void> {
  const habiaSesion = Boolean(tokenActual());
  const sesion = await asegurarSesion();
  if (habiaSesion && !sesion) {
    sesionExpirada();
    throw new Error("La sesión venció. Volvé a iniciar sesión.");
  }
  const cabeceras = new Headers();
  if (sesion) cabeceras.set("Authorization", `Bearer ${sesion.access_token}`);
  let respuesta: Response;
  try {
    respuesta = await fetch(url, { method: "GET", headers: cabeceras });
  } catch {
    throw new Error("No se pudo conectar con la API. ¿Está corriendo el backend?");
  }
  if (!respuesta.ok) {
    if (respuesta.status === 401 && sesion) {
      borrarSesion();
      sesionExpirada();
    }
    const cuerpo = await respuesta.json().catch(() => null);
    throw new Error(mensajeError(cuerpo) ?? `Error ${respuesta.status}`);
  }
  const blob = await respuesta.blob();
  const cd = respuesta.headers.get("Content-Disposition") || "";
  const m = cd.match(/filename=\"?([^\";]+)\"?/i);
  const nombre = m?.[1] || nombreFallback;
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

function _cuerpoRecalculo(
  perfil: number[],
  zonas: Zona[],
  proteinasTotales: string,
): { perfil: number[]; zonas: Zona[]; proteinas_totales?: number } {
  const cuerpo: { perfil: number[]; zonas: Zona[]; proteinas_totales?: number } = {
    perfil,
    zonas,
  };
  const texto = proteinasTotales.trim();
  if (texto) {
    const pt = Number(texto.replace(",", "."));
    if (!Number.isFinite(pt)) {
      throw new Error("Las proteínas totales no son un número válido");
    }
    cuerpo.proteinas_totales = pt;
  }
  return cuerpo;
}

// Recalcula un carril con los límites que el investigador confirmó a mano.
// No guarda nada: solo devuelve las fracciones recalculadas.
export async function recalcularLimites(
  perfil: number[],
  zonas: Zona[],
  proteinasTotales: string,
): Promise<CalculoLimites> {
  return pedirJson<CalculoLimites>(`${API_URL}/ensayos/recalcular`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(_cuerpoRecalculo(perfil, zonas, proteinasTotales)),
  });
}

// Recalculo libre sin autenticación.
export async function recalcularLimitesLibre(
  perfil: number[],
  zonas: Zona[],
  proteinasTotales: string,
): Promise<CalculoLimites> {
  return pedirJson<CalculoLimites>(
    `${API_URL}/tiras/recalcular-libre`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(_cuerpoRecalculo(perfil, zonas, proteinasTotales)),
    },
    { conSesion: false },
  );
}

// Descarga un reporte libre (POST JSON -> archivo) sin autenticación.
export async function descargarReporteLibre(
  ruta: "analisis-libre.xlsx" | "analisis-libre.pdf",
  datos: unknown,
  nombreFallback: string,
): Promise<void> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${API_URL}/reportes/${ruta}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
  } catch {
    throw new Error("No se pudo conectar con la API. ¿Está corriendo el backend?");
  }
  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => null);
    throw new Error(mensajeError(cuerpo) ?? `Error ${respuesta.status}`);
  }
  const blob = await respuesta.blob();
  const cd = respuesta.headers.get("Content-Disposition") || "";
  const m = cd.match(/filename=\"?([^\";]+)\"?/i);
  const nombre = m?.[1] || nombreFallback;
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}
