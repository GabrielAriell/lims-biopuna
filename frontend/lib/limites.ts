import type { Carril, Zona } from "./tipos";

// Diferencia mínima entre los extremos de una zona. Con 1, la zona tiene al
// menos dos columnas, que es lo que exige calcular_fracciones en el backend.
export const MIN_ANCHO_ZONA = 1;

// Los cortes son las columnas donde termina una zona y empieza la siguiente:
// [0, corte1, corte2, ..., ultima_columna]. Las zonas salen de a pares.
export function zonasDesdeCortes(cortes: number[]): Zona[] {
  const zonas: Zona[] = [];
  for (let i = 0; i < cortes.length - 1; i++) {
    zonas.push([cortes[i], cortes[i + 1]]);
  }
  return zonas;
}

export function normalizarCortes(cortes: number[], ultimo: number): number[] {
  const interiores = Array.from(new Set(cortes.slice(1, -1).map((v) => Math.round(v))))
    .filter((v) => v >= MIN_ANCHO_ZONA && v <= ultimo - MIN_ANCHO_ZONA)
    .sort((a, b) => a - b);

  const resultado = [0];
  for (const v of interiores) {
    if (v - resultado[resultado.length - 1] >= MIN_ANCHO_ZONA) resultado.push(v);
  }
  // El último corte siempre es la última columna; si quedó muy pegado, se descarta.
  while (resultado.length > 1 && ultimo - resultado[resultado.length - 1] < MIN_ANCHO_ZONA) {
    resultado.pop();
  }
  resultado.push(ultimo);
  return resultado;
}

// Reconstruye los cortes a partir de las fracciones que propuso el análisis.
export function cortesDesdeFracciones(carril: Carril): number[] {
  const ultimo = Math.max(1, carril.perfil.length - 1);
  const fines = carril.fracciones.map((f) => f.fin);
  return normalizarCortes([0, ...fines, ultimo], ultimo);
}

// Mueve un corte interior sin invadir a sus vecinos.
export function moverCorte(cortes: number[], indice: number, valor: number): number[] {
  if (indice <= 0 || indice >= cortes.length - 1) return cortes;

  const minimo = cortes[indice - 1] + MIN_ANCHO_ZONA;
  const maximo = cortes[indice + 1] - MIN_ANCHO_ZONA;
  const nuevo = Math.min(maximo, Math.max(minimo, Math.round(valor)));
  if (nuevo === cortes[indice]) return cortes;

  const copia = [...cortes];
  copia[indice] = nuevo;
  return copia;
}

// Divide por la mitad la zona más ancha, para que el investigador después
// arrastre el corte hasta el valle que corresponde.
export function agregarCorte(cortes: number[]): { cortes: number[]; indice: number } {
  let mejorZona = -1;
  let mejorAncho = 0;

  for (let z = 0; z < cortes.length - 1; z++) {
    const ancho = cortes[z + 1] - cortes[z];
    if (ancho >= 2 * MIN_ANCHO_ZONA && ancho > mejorAncho) {
      mejorAncho = ancho;
      mejorZona = z;
    }
  }
  if (mejorZona < 0) return { cortes, indice: -1 };

  const corte = Math.round((cortes[mejorZona] + cortes[mejorZona + 1]) / 2);
  const nuevos = [...cortes];
  nuevos.splice(mejorZona + 1, 0, corte);
  return { cortes: nuevos, indice: mejorZona + 1 };
}

export function quitarCorte(cortes: number[], indice: number): number[] {
  if (indice <= 0 || indice >= cortes.length - 1) return cortes;
  return cortes.filter((_, i) => i !== indice);
}
