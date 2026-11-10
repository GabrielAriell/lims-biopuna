import { descargarArchivoAutenticado } from "./api";
import { API_URL } from "./config";

export function exportarMuestrasExcel(): Promise<void> {
  return descargarArchivoAutenticado(
    `${API_URL}/reportes/muestras.xlsx`,
    "muestras.xlsx",
  );
}

export function exportarEnsayosExcel(): Promise<void> {
  return descargarArchivoAutenticado(
    `${API_URL}/reportes/ensayos.xlsx`,
    "ensayos.xlsx",
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
