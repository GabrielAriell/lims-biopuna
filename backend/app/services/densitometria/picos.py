"""Detección de picos y propuesta de límites entre fracciones."""
import numpy as np
from scipy.ndimage import gaussian_filter1d
from scipy.signal import find_peaks

SUAVIZADO_REL = 0.004      # sigma del suavizado, como fracción del largo del perfil
PROMINENCIA_REL = 0.05     # un pico debe sobresalir al menos este % del máximo
DISTANCIA_MIN_REL = 0.02   # separación mínima entre picos (fracción del largo)
FUSION_VALLE = 0.85        # si el valle entre dos picos llega a este % del menor, son una sola banda

Zona = tuple[int, int]     # (inicio, fin) en columnas del perfil, ambos incluidos


def suavizar(perfil: np.ndarray) -> np.ndarray:
    """Suaviza el perfil para detectar picos sin que el ruido los divida."""
    return gaussian_filter1d(perfil, sigma=max(1.0, len(perfil) * SUAVIZADO_REL))


def detectar_picos(perfil: np.ndarray, prominencia_rel: float = PROMINENCIA_REL) -> list[int]:
    """Devuelve las posiciones (columna) de los picos principales.

    prominencia_rel: cuánto debe sobresalir un pico (fracción del máximo).
    Más bajo detecta más picos; más alto, menos.
    """
    suave = suavizar(perfil)
    if suave.max() <= 0:
        return []
    picos, _ = find_peaks(
        suave,
        prominence=prominencia_rel * suave.max(),
        distance=max(1, int(len(suave) * DISTANCIA_MIN_REL)),
    )
    picos = list(picos)

    # Dos picos con un valle muy superficial entre ellos son una sola banda
    # (por ejemplo, la muesca en la cima de la albúmina): se queda el más alto.
    fusionado = True
    while fusionado and len(picos) > 1:
        fusionado = False
        for i in range(len(picos) - 1):
            a, b = picos[i], picos[i + 1]
            valle = suave[a:b + 1].min()
            if valle >= FUSION_VALLE * min(suave[a], suave[b]):
                picos.pop(i if suave[a] < suave[b] else i + 1)
                fusionado = True
                break
    return [int(p) for p in picos]


def proponer_limites(perfil: np.ndarray, prominencia_rel: float = PROMINENCIA_REL) -> list[Zona]:
    """Divide el perfil en una zona por pico, cortando en el valle entre picos.

    Estos cortes reemplazan al bisturí. Son una propuesta: el investigador
    puede ajustarlos antes de calcular.
    """
    ultimo = len(perfil) - 1
    picos = detectar_picos(perfil, prominencia_rel)
    if not picos:
        return [(0, ultimo)]

    suave = suavizar(perfil)
    valles = [a + int(np.argmin(suave[a:b + 1])) for a, b in zip(picos[:-1], picos[1:])]
    cortes = [0] + valles + [ultimo]
    return [(cortes[i], cortes[i + 1]) for i in range(len(cortes) - 1)]
