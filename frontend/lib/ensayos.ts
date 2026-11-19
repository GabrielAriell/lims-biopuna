import type { AnalisisTira } from "./tipos";
import type { CarrilParaGuardar } from "./tipos-ensayos";

// Convierte el análisis (ya con ajustes/ediciones aplicados) al formato que
// espera el backend. Un ensayo equivale a una sola tira, así que se envía un
// único carril con perfil, zonas y las fracciones validadas por el investigador.
export function prepararCarriles(analisis: AnalisisTira): {
  carriles: CarrilParaGuardar[];
  problemas: string[];
} {
  if (analisis.carriles.length !== 1) {
    return {
      carriles: [],
      problemas: ["El análisis debe tener una sola tira."],
    };
  }

  const carril = analisis.carriles[0];
  if (carril.error) {
    return { carriles: [], problemas: [carril.error] };
  }
  if (carril.fracciones.length === 0) {
    return { carriles: [], problemas: ["La tira no tiene fracciones."] };
  }

  return {
    carriles: [
      {
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
      },
    ],
    problemas: [],
  };
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
