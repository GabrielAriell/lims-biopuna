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


# def detectar_picos(perfil: np.ndarray, prominencia_rel: float = PROMINENCIA_REL) -> list[int]:
#     """Devuelve las posiciones (columna) de los picos principales.

#     prominencia_rel: cuánto debe sobresalir un pico (fracción del máximo).
#     Más bajo detecta más picos; más alto, menos.
#     """
#     suave = suavizar(perfil)
#     if suave.max() <= 0:
#         return []
#     picos, _ = find_peaks(
#         suave,
#         prominence=prominencia_rel * suave.max(),
#         distance=max(1, int(len(suave) * DISTANCIA_MIN_REL)),
#     )
#     picos = list(picos)

#     # Dos picos con un valle muy superficial entre ellos son una sola banda
#     # (por ejemplo, la muesca en la cima de la albúmina): se queda el más alto.
#     fusionado = True
#     while fusionado and len(picos) > 1:
#         fusionado = False
#         for i in range(len(picos) - 1):
#             a, b = picos[i], picos[i + 1]
#             valle = suave[a:b + 1].min()
#             if valle >= FUSION_VALLE * min(suave[a], suave[b]):
#                 picos.pop(i if suave[a] < suave[b] else i + 1)
#                 fusionado = True
#                 break
#     return [int(p) for p in picos]

def detectar_picos(
    perfil: np.ndarray,
    prominencia_rel: float = PROMINENCIA_REL,
    cantidad_fracciones: int | None = None,
) -> list[int]:
    """Devuelve las posiciones (columna) de los picos principales."""
    suave = suavizar(perfil)
    if suave.max() <= 0:
        return []

    # Si se pide una cantidad fija, arrancamos con prominencia muy baja para capturar
    # todos los candidatos (incluidas bandas tenues como Alfa1 o Beta2) y elegimos
    # los N más prominentes.
    prom_inicial = 0.002 if cantidad_fracciones else prominencia_rel
    picos, props = find_peaks(
        suave,
        prominence=prom_inicial * suave.max(),
        distance=max(1, int(len(suave) * DISTANCIA_MIN_REL)),
    )
    picos = list(picos)

    # Fusión de muescas superficiales (solo si no nos quedamos cortos de bandas)
    fusionado = True
    while fusionado and len(picos) > (cantidad_fracciones or 1):
        fusionado = False
        for i in range(len(picos) - 1):
            a, b = picos[i], picos[i + 1]
            valle = suave[a:b + 1].min()
            if valle >= FUSION_VALLE * min(suave[a], suave[b]):
                picos.pop(i if suave[a] < suave[b] else i + 1)
                fusionado = True
                break

    # Si se especificó 4, 5 o 6 fracciones y hay más candidatos, nos quedamos
    # con los N de mayor prominencia, ordenados de izquierda a derecha.
    if cantidad_fracciones and len(picos) > cantidad_fracciones:
        _, props_filtrados = find_peaks(suave, prominence=0, distance=1)
        mapa_prom = dict(zip(
            find_peaks(suave, prominence=0, distance=1)[0],
            props_filtrados["prominences"],
        ))
        mejores = sorted(picos, key=lambda p: mapa_prom.get(p, 0), reverse=True)[:cantidad_fracciones]
        picos = sorted(mejores)

    return [int(p) for p in picos]


# def proponer_limites(perfil: np.ndarray, prominencia_rel: float = PROMINENCIA_REL) -> list[Zona]:
#     """Divide el perfil en una zona por pico, cortando en el valle entre picos.

#     Estos cortes reemplazan al bisturí. Son una propuesta: el investigador
#     puede ajustarlos antes de calcular.
#     """
#     ultimo = len(perfil) - 1
#     picos = detectar_picos(perfil, prominencia_rel)
#     if not picos:
#         return [(0, ultimo)]

#     suave = suavizar(perfil)
#     valles = [a + int(np.argmin(suave[a:b + 1])) for a, b in zip(picos[:-1], picos[1:])]
#     cortes = [0] + valles + [ultimo]
#     return [(cortes[i], cortes[i + 1]) for i in range(len(cortes) - 1)]

def proponer_limites(
    perfil: np.ndarray,
    prominencia_rel: float = PROMINENCIA_REL,
    cantidad_fracciones: int | None = None,
) -> list[Zona]:
    """Divide el perfil en una zona por pico, cortando en valles y puntos de inflexión."""
    ultimo = len(perfil) - 1
    picos = detectar_picos(perfil, prominencia_rel, cantidad_fracciones)
    if not picos:
        return [(0, ultimo)]

    suave = suavizar(perfil)
    valles = [a + int(np.argmin(suave[a:b + 1])) for a, b in zip(picos[:-1], picos[1:])]
    cortes = [0] + valles + [ultimo]

    # Si se pidió una cantidad fija (4, 5 o 6) y faltan cortes (por hombros sin valle),
    # subdividimos en los puntos de inflexión más marcados de la segunda derivada.
    if cantidad_fracciones and (len(cortes) - 1) < cantidad_fracciones:
        d2 = np.gradient(np.gradient(suave))
        # Los puntos de inflexión/hombros entre bandas corresponden a máximos locales de d2
        inflexiones, props = find_peaks(d2, prominence=0)
        margen = max(5, int(len(suave) * DISTANCIA_MIN_REL))

        candidatos = sorted(
            zip(inflexiones, props["prominences"]),
            key=lambda item: item[1],
            reverse=True,
        )
        for pos, _ in candidatos:
            if (len(cortes) - 1) >= cantidad_fracciones:
                break
            pos = int(pos)
            # Evitar cortar demasiado cerca de un corte ya existente o de los bordes
            if all(abs(pos - c) >= margen for c in cortes):
                cortes.append(pos)
                cortes.sort()

    return [(cortes[i], cortes[i + 1]) for i in range(len(cortes) - 1)]