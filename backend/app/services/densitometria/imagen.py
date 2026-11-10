"""Lectura, orientación y recorte de imágenes."""
import cv2
import numpy as np

Region = tuple[int, int, int, int]  # (x, y, ancho, alto) en píxeles


def cargar_imagen(datos: bytes) -> np.ndarray:
    """Decodifica los bytes de una imagen (jpg, png...) a una matriz BGR."""
    arreglo = np.frombuffer(datos, dtype=np.uint8)
    imagen = cv2.imdecode(arreglo, cv2.IMREAD_COLOR)
    if imagen is None:
        raise ValueError("No se pudo leer la imagen")
    return imagen


def orientar(imagen: np.ndarray, vertical: bool = False, invertir: bool = False) -> np.ndarray:
    """Deja la tira con la migración en horizontal.

    - vertical: la tira está parada (migración de arriba hacia abajo); se gira 90°.
    - invertir: da vuelta la imagen de izquierda a derecha (cambia el sentido).
    """
    if vertical:
        imagen = cv2.rotate(imagen, cv2.ROTATE_90_CLOCKWISE)
    if invertir:
        imagen = cv2.flip(imagen, 1)
    return imagen


def limitar_region(alto: int, ancho: int, region: Region) -> Region:
    """Ajusta una región para que no se salga de la imagen."""
    x, y, w, h = region
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(ancho, x + w), min(alto, y + h)
    if x1 - x0 < 10 or y1 - y0 < 10:
        raise ValueError("El recorte es demasiado chico")
    return (x0, y0, x1 - x0, y1 - y0)


def recortar(imagen: np.ndarray, region: Region) -> np.ndarray:
    """Recorta la región (x, y, ancho, alto) de la imagen."""
    x, y, w, h = limitar_region(imagen.shape[0], imagen.shape[1], region)
    return imagen[y:y + h, x:x + w]
