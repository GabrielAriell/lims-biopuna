import { pedirJson } from "./api";
import { API_URL } from "./config";
import type {
  Campana,
  Departamento,
  EstadoMuestra,
  Muestra,
  NuevaCampana,
  NuevaMuestra,
  Provincia,
} from "./tipos-muestras";

export function listarCampanas(): Promise<Campana[]> {
  return pedirJson<Campana[]>(`${API_URL}/campanas`, { method: "GET" });
}

export function listarProvincias(): Promise<Provincia[]> {
  return pedirJson<Provincia[]>(`${API_URL}/geografia/provincias`, {
    method: "GET",
  });
}

export function listarDepartamentos(idProvincia?: number): Promise<Departamento[]> {
  const q = idProvincia ? `?id_provincia=${idProvincia}` : "";
  return pedirJson<Departamento[]>(`${API_URL}/geografia/departamentos${q}`, {
    method: "GET",
  });
}

export function crearCampana(datos: NuevaCampana): Promise<Campana> {
  return pedirJson<Campana>(`${API_URL}/campanas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
}

export function listarMuestras(
  filtros: { idCampana?: number; estado?: EstadoMuestra } = {},
): Promise<Muestra[]> {
  const parametros = new URLSearchParams();
  if (filtros.idCampana) parametros.set("id_campana", String(filtros.idCampana));
  if (filtros.estado) parametros.set("estado", filtros.estado);
  const consulta = parametros.toString();
  return pedirJson<Muestra[]>(
    `${API_URL}/muestras${consulta ? `?${consulta}` : ""}`,
    { method: "GET" },
  );
}

export function obtenerMuestra(idMuestra: number): Promise<Muestra> {
  return pedirJson<Muestra>(`${API_URL}/muestras/${idMuestra}`, {
    method: "GET",
  });
}

export function crearMuestra(datos: NuevaMuestra): Promise<Muestra> {
  return pedirJson<Muestra>(`${API_URL}/muestras`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
}
