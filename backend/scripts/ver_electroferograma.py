"""Analiza una imagen (o todas las de una carpeta) y guarda un gráfico y un CSV.

Uso:
  python -m scripts.ver_electroferograma ejemplos/tira.jpg
  python -m scripts.ver_electroferograma ejemplos/visita --pt 6.5

Opciones:
  --pt 6.5            proteínas totales (g/dL), para calcular concentraciones
  --carriles 2        forzar la cantidad de carriles
  --prominencia 0.03  sensibilidad de picos (más bajo = más picos)
  --modo absorbancia  usar absorbancia en lugar de gris invertido
  --vertical          la tira está parada (migración de arriba hacia abajo)
  --invertir          dar vuelta el sentido (izquierda <-> derecha)
  --region x,y,ancho,alto   recorte manual en píxeles
Resultados en la carpeta "salida": un PNG por imagen y resumen.csv
"""
import argparse
import csv
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

from app.services.densitometria import analizar_tira, calcular_fracciones, proponer_limites

EXTENSIONES = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp"}
SALIDA = Path("salida")


def region_arg(texto: str) -> tuple[int, int, int, int]:
    partes = [int(v) for v in texto.split(",")]
    if len(partes) != 4:
        raise argparse.ArgumentTypeError("usá el formato x,y,ancho,alto")
    return tuple(partes)


def listar_imagenes(ruta: Path) -> list[Path]:
    if ruta.is_dir():
        return sorted(p for p in ruta.iterdir() if p.suffix.lower() in EXTENSIONES)
    return [ruta]


def num(valor, decimales: int = 2) -> str:
    """Número con coma decimal, para abrir el CSV en Excel en español."""
    return "" if valor is None else f"{valor:.{decimales}f}".replace(".", ",")


def dibujar(resultado, calculos, titulo: str, destino: Path) -> None:
    tira = resultado.imagen[:, :, ::-1]   # BGR -> RGB
    ancho = tira.shape[1]
    n = len(calculos)
    fig, ejes = plt.subplots(
        n + 1, 1, figsize=(12, 3 + 3.2 * n), sharex=True,
        gridspec_kw={"height_ratios": [1.2] + [2.0] * n},
    )
    ejes = np.atleast_1d(ejes)
    ejes[0].imshow(tira, aspect="auto", extent=[0, ancho, tira.shape[0], 0])
    ejes[0].set_title(f"{titulo} - tira recortada")
    ejes[0].set_yticks([])

    colores = plt.get_cmap("tab10").colors
    for i, (carril, calculo) in enumerate(zip(resultado.carriles, calculos), start=1):
        eje = ejes[i]
        x = np.arange(len(carril.perfil))
        eje.plot(x, carril.perfil, color="black", lw=1.6, label="Perfil")
        for k, fr in enumerate(calculo.fracciones):
            zona = slice(fr.inicio, fr.fin + 1)
            eje.fill_between(x[zona], carril.perfil[zona], color=colores[k % 10], alpha=0.45,
                             label=f"{fr.nombre} ({fr.porcentaje:.1f}%)")
            eje.plot(fr.pico, carril.perfil[fr.pico], "rx", ms=9, mew=2)
        eje.set_title(f"Electroferograma - carril {i}")
        eje.set_ylabel("Densidad relativa")
        eje.grid(alpha=0.3, ls="--")
        eje.legend(loc="upper right", fontsize=8)

    ejes[-1].set_xlabel("Posición a lo largo de la tira (píxeles)")
    ejes[-1].set_xlim(0, ancho)
    fig.tight_layout()
    fig.savefig(destino, dpi=110)
    plt.close(fig)


def procesar(ruta: Path, args, escritor) -> None:
    resultado = analizar_tira(
        ruta.read_bytes(),
        region=args.region,
        n_carriles=args.carriles,
        modo=args.modo,
        vertical=args.vertical,
        invertir=args.invertir,
    )
    x, y, w, h = resultado.region
    origen = "automatico" if resultado.recorte_automatico else "manual o imagen completa"
    print(f"\n{ruta.name}: recorte {origen} (x={x} y={y} ancho={w} alto={h}), "
          f"{len(resultado.carriles)} carril(es)")

    for aviso in resultado.advertencias:
        print("  AVISO:", aviso)

    calculos = []
    for i, carril in enumerate(resultado.carriles, start=1):
        zonas = proponer_limites(carril.perfil, args.prominencia)
        calculo = calcular_fracciones(carril.perfil, zonas, args.pt)
        calculos.append(calculo)

        print(f"  Carril {i}: {len(calculo.fracciones)} fracciones")
        for fr in calculo.fracciones:
            conc = "" if fr.concentracion_g_dl is None else f"  {fr.concentracion_g_dl:.2f} g/dL"
            print(f"    {fr.nombre:<10} {fr.porcentaje:5.1f} %{conc}")
            escritor.writerow([
                ruta.name, i, fr.nombre, num(fr.porcentaje, 1), num(fr.area, 1),
                num(fr.concentracion_g_dl), num(calculo.relacion_ag), " ".join(calculo.advertencias),
            ])
        if calculo.relacion_ag is not None:
            print(f"    Relacion A/G: {calculo.relacion_ag:.2f}")
        for aviso in calculo.advertencias:
            print("    AVISO:", aviso)

    dibujar(resultado, calculos, ruta.name, SALIDA / f"{ruta.stem}.png")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("ruta", nargs="?", default="ejemplos/tira_ejemplo.jpg", type=Path)
    parser.add_argument("--pt", type=float, default=None)
    parser.add_argument("--carriles", type=int, default=None)
    parser.add_argument("--prominencia", type=float, default=0.05)
    parser.add_argument("--modo", default="gris_invertido", choices=["gris_invertido", "verde_invertido", "absorbancia"])
    parser.add_argument("--vertical", action="store_true")
    parser.add_argument("--invertir", action="store_true")
    parser.add_argument("--region", type=region_arg, default=None)
    args = parser.parse_args()

    imagenes = listar_imagenes(args.ruta)
    if not imagenes:
        raise SystemExit(f"No encontré imágenes en {args.ruta}")

    SALIDA.mkdir(exist_ok=True)
    with open(SALIDA / "resumen.csv", "w", newline="", encoding="utf-8-sig") as f:
        escritor = csv.writer(f, delimiter=";")
        escritor.writerow(["archivo", "carril", "fraccion", "porcentaje", "area",
                           "concentracion_g_dl", "relacion_ag", "avisos"])
        for ruta in imagenes:
            try:
                procesar(ruta, args, escritor)
            except ValueError as error:
                print(f"\n{ruta.name}: NO SE PUDO ANALIZAR ({error})")

    print(f"\nListo. Resultados en la carpeta '{SALIDA}'")


if __name__ == "__main__":
    main()

