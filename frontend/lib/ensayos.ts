import type { AnalisisTira } from "./tipos";
import type { CarrilParaGuardar } from "./tipos-ensayos";

// Convierte el análisis (ya con ajustes/ediciones aplicados) al formato que
// espera el backend. Se envían perfil, zonas y las fracciones validadas por el
// investigador para guardarlas tal cual.
export function prepararCarriles(analisis: AnalisisTira): {
  carriles: CarrilParaGuardar[];
  problemas: string[];
} {
  const carriles: CarrilParaGuardar[] = [];
  const problemas: string[] = [];

  for (const carril of analisis.carriles) {
    if (carril.error) {
      problemas.push(`Carril ${carril.indice}: ${carril.error}`);
      continue;
    }
    if (carril.fracciones.length === 0) {
      problemas.push(`Carril ${carril.indice}: no tiene fracciones.`);
      continue;
    }

    carriles.push({
      perfil: carril.perfil,
      zonas: carril.fracciones.map(
        (fraccion) => [fraccion.inicio, fraccion.fin] as [number, number],
      ),
      fracciones: carril.fracciones.map((fraccion) => ({
        nombre_fraccion: fraccion.nombre,
        area_integrada: fraccion.area,
        porcentaje_relativo: fraccion.porcentaje,
        concentracion_g_dl: fraccion.concentracion_g_dl ?? 0,
      })),
    });
  }

  return { carriles, problemas };
}

// Acepta coma o punto decimal y valida el mismo rango que la base (0 a 20).
export function proteinasTotalesNumero(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");
  if (!limpio) return null;
  const valor = Number(limpio);
  if (!Number.isFinite(valor) || valor <= 0 || valor > 20) return null;
  return valor;
}

// El análisis devuelve la imagen como data URL; para subirla hay que pasarla
// a bytes.
export async function dataUrlABlob(dataUrl: string): Promise<Blob> {
  const respuesta = await fetch(dataUrl);
  if (!respuesta.ok) {
    throw new Error("No se pudo preparar la imagen para guardar");
  }
  return respuesta.blob();
}
