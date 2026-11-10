"""Conversión de imagen a densidad óptica relativa."""
import cv2
import numpy as np

SUAVIZADO_SIGMA = 1.5
PERCENTIL_FONDO = 99
MODOS = ("gris_invertido", "verde_invertido", "absorbancia")
MODO_POR_DEFECTO = "gris_invertido"


def a_densidad_optica(imagen: np.ndarray, modo: str = MODO_POR_DEFECTO) -> np.ndarray:
    """Imagen BGR -> densidad óptica relativa, mayor valor = más tinción.

    Modos:
    - "gris_invertido": lo que describe el documento (Etapa 1). Brillo del
      fondo menos brillo de cada punto, en escala de grises.
    - "verde_invertido": igual, pero usando solo el canal verde. Un colorante
      rojo o rosado absorbe sobre todo luz verde (el laboratorio lee a 510 nm),
      así que ese canal da más contraste en las bandas tenues.
    - "absorbancia": -log10(I / I0) sobre el gris (definición física).

    En todos los casos I0 es el brillo del papel sin teñir (percentil 99),
    que cumple el rol del "blanco" del espectrofotómetro.
    """
    if modo not in MODOS:
        raise ValueError(f"Modo desconocido: {modo}. Opciones: {', '.join(MODOS)}")

    if modo == "verde_invertido":
        canal = imagen[:, :, 1]                      # BGR: el índice 1 es el verde
    else:
        canal = cv2.cvtColor(imagen, cv2.COLOR_BGR2GRAY)
    luz = cv2.GaussianBlur(canal.astype(np.float32), (0, 0), sigmaX=SUAVIZADO_SIGMA)
    i0 = float(np.percentile(luz, PERCENTIL_FONDO))

    if modo == "absorbancia":
        od = -np.log10(np.clip(luz, 1.0, None) / max(i0, 1.0))
        return np.clip(od, 0.0, None)
    return np.clip(i0 - luz, 0.0, None)
