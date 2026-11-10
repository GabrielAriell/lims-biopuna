import type { AnalisisTira, CalculoLimites } from "./tipos";

// Ajustes confirmados por el investigador, indexados por número de carril.
export type AjustesPorCarril = Record<number, CalculoLimites>;

// Devuelve una copia del análisis donde cada carril ajustado usa las
// fracciones confirmadas a mano. El resto queda igual. Es pura a propósito:
// sirve para exportar y, más adelante, para guardar en la base.
export function aplicarAjustes(
  analisis: AnalisisTira,
  ajustes: AjustesPorCarril,
): AnalisisTira {
  return {
    ...analisis,
    carriles: analisis.carriles.map((carril) => {
      const ajuste = ajustes[carril.indice];
      if (!ajuste) return carril;
      return {
        ...carril,
        fracciones: ajuste.fracciones,
        nombres_asignados: ajuste.nombres_asignados,
        relacion_ag: ajuste.relacion_ag,
        advertencias: ajuste.advertencias,
      };
    }),
  };
}
