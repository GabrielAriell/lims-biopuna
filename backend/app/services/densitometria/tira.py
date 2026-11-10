"""Detección automática de la tira dentro de la foto o escaneo."""
import cv2
import numpy as np

ANCHO_ANALISIS = 800     # se analiza una copia reducida (más rápido)
CANNY_BAJO = 8
CANNY_ALTO = 24
FRACCION_RELATIVA = 0.5  # un borde es "largo" si mide al menos la mitad del más largo
FRACCION_MINIMA = 0.10   # ...y al menos este % de la imagen (descarta ruido)
MARGEN_X = 0.015         # se entra un poco hacia adentro para no leer el borde de la tira
MARGEN_Y = 0.04


def detectar_tira(imagen: np.ndarray) -> tuple[int, int, int, int] | None:
    """Busca los bordes largos de la tira y devuelve (x, y, ancho, alto).

    Devuelve None si no encuentra la tira (por ejemplo, si la imagen ya
    está recortada). En ese caso se usa la imagen completa.
    """
    alto, ancho = imagen.shape[:2]
    escala = min(1.0, ANCHO_ANALISIS / ancho)
    chica = imagen
    if escala < 1.0:
        chica = cv2.resize(imagen, None, fx=escala, fy=escala, interpolation=cv2.INTER_AREA)

    gris = cv2.GaussianBlur(cv2.cvtColor(chica, cv2.COLOR_BGR2GRAY), (5, 5), 0)
    bordes = cv2.Canny(gris, CANNY_BAJO, CANNY_ALTO) > 0
    h, w = bordes.shape

    por_fila = bordes.sum(axis=1) / w       # cuánto de cada fila es borde
    por_columna = bordes.sum(axis=0) / h    # cuánto de cada columna es borde
    filas = np.where(por_fila > max(FRACCION_RELATIVA * por_fila.max(), FRACCION_MINIMA))[0]
    columnas = np.where(por_columna > max(FRACCION_RELATIVA * por_columna.max(), FRACCION_MINIMA))[0]
    if len(filas) < 2 or len(columnas) < 2:
        return None

    x0, x1 = int(columnas.min() / escala), int(columnas.max() / escala)
    y0, y1 = int(filas.min() / escala), int(filas.max() / escala)
    if x1 - x0 < 0.1 * ancho or y1 - y0 < 0.03 * alto:
        return None

    mx = int((x1 - x0) * MARGEN_X)
    my = int((y1 - y0) * MARGEN_Y)
    return (x0 + mx, y0 + my, (x1 - x0) - 2 * mx, (y1 - y0) - 2 * my)
