"""Detección de carriles en la tira."""
import numpy as np
from scipy.ndimage import uniform_filter1d

UMBRAL_CARRIL = 0.15      # una fila tiene carril si supera este % del máximo
SEPARACION_MIN = 0.03     # espacio mínimo entre carriles (fracción del alto)
ALTURA_MIN_REL = 0.3      # se descartan tramos más finos que este % de la mediana


def _tramos(mascara: np.ndarray) -> list[tuple[int, int]]:
    """Devuelve los tramos consecutivos (inicio, fin) donde la máscara es True."""
    tramos, inicio = [], None
    for i, valor in enumerate(mascara):
        if valor and inicio is None:
            inicio = i
        elif not valor and inicio is not None:
            tramos.append((inicio, i))
            inicio = None
    if inicio is not None:
        tramos.append((inicio, len(mascara)))
    return tramos


def detectar_carriles(od: np.ndarray, n_carriles: int | None = None) -> list[tuple[int, int]]:
    """Detecta los carriles (apilados verticalmente, migración horizontal).

    Devuelve una lista de (fila_inicio, fila_fin), uno por carril.
    - Si n_carriles es un número, divide la imagen en esa cantidad de franjas iguales.
    - Si es None, busca los espacios vacíos entre carriles en el perfil vertical.
    """
    alto = od.shape[0]
    if n_carriles is not None:
        if n_carriles < 1:
            raise ValueError("n_carriles debe ser al menos 1")
        bordes = np.linspace(0, alto, n_carriles + 1).astype(int)
        return [(int(bordes[i]), int(bordes[i + 1])) for i in range(n_carriles)]

    perfil = uniform_filter1d(od.mean(axis=1), size=max(3, alto // 100))
    maximo = float(perfil.max())
    if maximo <= 0:
        return [(0, alto)]

    tramos = _tramos(perfil > UMBRAL_CARRIL * maximo)
    if not tramos:
        return [(0, alto)]

    separacion_minima = max(5, int(alto * SEPARACION_MIN))
    unidos = [tramos[0]]
    for inicio, fin in tramos[1:]:
        if inicio - unidos[-1][1] < separacion_minima:
            unidos[-1] = (unidos[-1][0], fin)
        else:
            unidos.append((inicio, fin))

    alturas = np.array([fin - ini for ini, fin in unidos])
    minimo = ALTURA_MIN_REL * float(np.median(alturas))
    return [(ini, fin) for ini, fin in unidos if fin - ini >= minimo]
