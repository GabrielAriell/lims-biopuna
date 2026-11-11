import { descargarArchivoAutenticado } from "./api";
import { API_URL } from "./config";

export type FiltrosReporte = {
  idCampana?: string;
  especie?: string;
  estado?: string;
  departamento?: string;
  convenio?: "con" | "sin";
  fechaDesde?: string;
  fechaHasta?: string;
  busqueda?: string;
  investigador?: string;
};

function consulta(filtros?: FiltrosReporte): string {
  if (!filtros) return "";
  const parametros = new URLSearchParams();
  const valores: Array<[string, string | undefined]> = [
    ["id_campana", filtros.idCampana],
    ["especie", filtros.especie],
    ["estado", filtros.estado],
    ["departamento", filtros.departamento],
    ["convenio", filtros.convenio],
    ["fecha_desde", filtros.fechaDesde],
    ["fecha_hasta", filtros.fechaHasta],
    ["busqueda", filtros.busqueda],
    ["investigador", filtros.investigador],
  ];
  for (const [clave, valor] of valores) {
    if (valor) parametros.set(clave, valor);
  }
  const texto = parametros.toString();
  return texto ? `?${texto}` : "";
}

export function exportarMuestrasExcel(filtros?: FiltrosReporte): Promise<void> {
  return descargarArchivoAutenticado(
    `${API_URL}/reportes/muestras.xlsx${consulta(filtros)}`,
    "muestras.xlsx",
  );
}

export function exportarEnsayosExcel(filtros?: FiltrosReporte): Promise<void> {
  return descargarArchivoAutenticado(
    `${API_URL}/reportes/ensayos.xlsx${consulta(filtros)}`,
    "ensayos.xlsx",
  );
}

export function exportarTerritorialPdf(filtros?: FiltrosReporte): Promise<void> {
  return descargarArchivoAutenticado(
    `${API_URL}/reportes/territorial.pdf${consulta(filtros)}`,
    "analisis_territorial.pdf",
  );
}

export function exportarMuestraExcel(idMuestra: number): Promise<void> {
  return descargarArchivoAutenticado(
    `${API_URL}/reportes/muestra/${idMuestra}.xlsx`,
    `muestra_${idMuestra}.xlsx`,
  );
}

export function exportarMuestraPdf(idMuestra: number): Promise<void> {
  return descargarArchivoAutenticado(
    `${API_URL}/reportes/muestra/${idMuestra}.pdf`,
    `muestra_${idMuestra}.pdf`,
  );
}
