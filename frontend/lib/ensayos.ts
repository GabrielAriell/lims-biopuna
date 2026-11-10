import type { AnalisisTira } from "./tipos";
import type { CarrilParaGuardar } from "./tipos-ensayos";

// Convierte el análisis (ya con los ajustes aplicados) al formato que espera
// el backend. El backend vuelve a calcular las fracciones con estos perfiles y
// zonas, así que acá solo se eligen los datos, no los resultados.
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
    if (!carril.nombres_asignados) {
      problemas.push(
        `Carril ${carril.indice}: tiene ${carril.fracciones.length} fracciones. ` +
          "Ajustá los límites para obtener 5 o 6 antes de guardar.",
      );
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
