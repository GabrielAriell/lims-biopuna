import type { AnalisisTira } from "./tipos";

const num = (v: number | null, decimales = 2) =>
  v === null ? "" : v.toFixed(decimales).replace(".", ",");

// CSV con ";" y coma decimal: se abre bien en Excel en español.
export function resultadosACsv(nombreImagen: string, a: AnalisisTira): string {
  const filas = [
    ["imagen", "carril", "fraccion", "porcentaje", "g_dl", "area", "relacion_a_g"],
  ];
  for (const c of a.carriles) {
    for (const f of c.fracciones) {
      filas.push([
        nombreImagen,
        String(c.indice),
        f.nombre,
        num(f.porcentaje),
        num(f.concentracion_g_dl, 3),
        num(f.area, 1),
        num(c.relacion_ag),
      ]);
    }
  }
  return "\uFEFF" + filas.map((fila) => fila.join(";")).join("\r\n");
}

export function descargarTexto(nombre: string, contenido: string): void {
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}
