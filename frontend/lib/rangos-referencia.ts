import type { Especie } from "./tipos-muestras";

export type NivelRango = "normal" | "alerta" | "critico";

export type RangoParametro = {
  // Unidad esperada del valor comparado: "g_dl" o "relacion".
  unidad: "g_dl" | "relacion";
  // Límites de referencia (normales). Fuera de estos => alerta (o crítico si se definen).
  min?: number;
  max?: number;
  // Límites opcionales para marcar crítico (más allá de alerta).
  minCritico?: number;
  maxCritico?: number;
  // Etiqueta a mostrar cuando está fuera de rango.
  etiqueta?: string;
};

export type RangosEspecie = {
  // Clave por nombre de fracción (ej. "Albúmina", "Alfa 1") o especial "A/G".
  parametros: Record<string, RangoParametro>;
  // Etiqueta por defecto para la especie/contexto.
  etiqueta?: string;
};

export type EvaluacionRango = {
  nivel: NivelRango;
  etiqueta?: string;
};

// Calcula A/G a partir de fracciones (g/dL). Globulinas = proteínas totales - albúmina.
export function calcularRelacionAG(
  fracciones: Array<{ nombre_fraccion: string; concentracion_g_dl: number }>,
  proteinasTotalesGdl?: number | null,
): number | null {
  const albumina = fracciones.find((f) =>
    f.nombre_fraccion.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes("album"),
  );
  if (!albumina || !Number.isFinite(albumina.concentracion_g_dl)) return null;
  const alb = albumina.concentracion_g_dl;
  let globulinas: number | null = null;
  if (proteinasTotalesGdl != null && Number.isFinite(proteinasTotalesGdl)) {
    globulinas = proteinasTotalesGdl - alb;
  } else {
    const sumaOtras = fracciones
      .filter((f) => f !== albumina)
      .reduce((acc, f) => acc + (Number.isFinite(f.concentracion_g_dl) ? f.concentracion_g_dl : 0), 0);
    globulinas = sumaOtras > 0 ? sumaOtras : null;
  }
  if (globulinas == null || globulinas <= 0) return null;
  return alb / globulinas;
}

// RANGOS BIOLÓGICOS DE REFERENCIA (editar con datos del laboratorio/investigadora).
// Ejemplo inicial solicitado: Llama con Albúmina < 2.8 g/dL o A/G < 0.6 fuera de rango.
// Completar/ajustar mañana con los valores validados por especie y parámetro.
export const RANGOS_POR_ESPECIE: Partial<Record<Especie, RangosEspecie>> = {
  Llama: {
    etiqueta: "Fuera de rango de referencia para camélidos de altura",
    parametros: {
      "Albúmina": { unidad: "g_dl", min: 2.8 },
      "A/G": { unidad: "relacion", min: 0.6 },
      // Agregar/ajustar: "Alfa 1", "Alfa 2", "Beta 1", "Beta 2", "Gamma", etc.
    },
  },
  Vicuña: {
    etiqueta: "Fuera de rango de referencia",
    parametros: {
      // Completar con datos de laboratorio.
    },
  },
  Ovino: {
    etiqueta: "Fuera de rango de referencia",
    parametros: {
      // Completar con datos de laboratorio.
    },
  },
};

function normalizarNombre(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buscarParametro(rangos: RangosEspecie, nombre: string): RangoParametro | undefined {
  if (rangos.parametros[nombre]) return rangos.parametros[nombre];
  const buscado = normalizarNombre(nombre);
  for (const [clave, valor] of Object.entries(rangos.parametros)) {
    if (normalizarNombre(clave) === buscado) return valor;
  }
  return undefined;
}

export function evaluarValor(
  especie: Especie | null | undefined,
  nombreParametro: string,
  valor: number | null | undefined,
): EvaluacionRango | null {
  if (!especie || valor === null || valor === undefined || !Number.isFinite(valor)) return null;
  const rangos = RANGOS_POR_ESPECIE[especie];
  if (!rangos) return null;
  const param = buscarParametro(rangos, nombreParametro);
  if (!param) return null;

  const { min, max, minCritico, maxCritico } = param;
  const esCritico =
    (minCritico !== undefined && valor < minCritico) ||
    (maxCritico !== undefined && valor > maxCritico);
  const esAlerta =
    (min !== undefined && valor < min) ||
    (max !== undefined && valor > max);

  if (esCritico) return { nivel: "critico", etiqueta: param.etiqueta ?? rangos.etiqueta };
  if (esAlerta) return { nivel: "alerta", etiqueta: param.etiqueta ?? rangos.etiqueta };
  return { nivel: "normal" };
}