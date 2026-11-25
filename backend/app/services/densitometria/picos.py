# """Detección de picos y propuesta de límites entre fracciones."""
# import numpy as np
# from scipy.ndimage import gaussian_filter1d
# from scipy.signal import find_peaks

# SUAVIZADO_REL = 0.004      # sigma del suavizado, como fracción del largo del perfil
# PROMINENCIA_REL = 0.05     # un pico debe sobresalir al menos este % del máximo
# DISTANCIA_MIN_REL = 0.02   # separación mínima entre picos (fracción del largo)
# FUSION_VALLE = 0.85        # si el valle entre dos picos llega a este % del menor, son una sola banda

# Zona = tuple[int, int]     # (inicio, fin) en columnas del perfil, ambos incluidos


# def suavizar(perfil: np.ndarray) -> np.ndarray:
#     """Suaviza el perfil para detectar picos sin que el ruido los divida."""
#     return gaussian_filter1d(perfil, sigma=max(1.0, len(perfil) * SUAVIZADO_REL))


# # def detectar_picos(perfil: np.ndarray, prominencia_rel: float = PROMINENCIA_REL) -> list[int]:
# #     """Devuelve las posiciones (columna) de los picos principales.

# #     prominencia_rel: cuánto debe sobresalir un pico (fracción del máximo).
# #     Más bajo detecta más picos; más alto, menos.
# #     """
# #     suave = suavizar(perfil)
# #     if suave.max() <= 0:
# #         return []
# #     picos, _ = find_peaks(
# #         suave,
# #         prominence=prominencia_rel * suave.max(),
# #         distance=max(1, int(len(suave) * DISTANCIA_MIN_REL)),
# #     )
# #     picos = list(picos)

# #     # Dos picos con un valle muy superficial entre ellos son una sola banda
# #     # (por ejemplo, la muesca en la cima de la albúmina): se queda el más alto.
# #     fusionado = True
# #     while fusionado and len(picos) > 1:
# #         fusionado = False
# #         for i in range(len(picos) - 1):
# #             a, b = picos[i], picos[i + 1]
# #             valle = suave[a:b + 1].min()
# #             if valle >= FUSION_VALLE * min(suave[a], suave[b]):
# #                 picos.pop(i if suave[a] < suave[b] else i + 1)
# #                 fusionado = True
# #                 break
# #     return [int(p) for p in picos]

# def detectar_picos(
#     perfil: np.ndarray,
#     prominencia_rel: float = PROMINENCIA_REL,
#     cantidad_fracciones: int | None = None,
# ) -> list[int]:
#     """Devuelve las posiciones (columna) de los picos principales."""
#     suave = suavizar(perfil)
#     if suave.max() <= 0:
#         return []

#     # Si se pide una cantidad fija, arrancamos con prominencia muy baja para capturar
#     # todos los candidatos (incluidas bandas tenues como Alfa1 o Beta2) y elegimos
#     # los N más prominentes.
#     prom_inicial = 0.002 if cantidad_fracciones else prominencia_rel
#     picos, props = find_peaks(
#         suave,
#         prominence=prom_inicial * suave.max(),
#         distance=max(1, int(len(suave) * DISTANCIA_MIN_REL)),
#     )
#     picos = list(picos)

#     # Fusión de muescas superficiales (solo si no nos quedamos cortos de bandas)
#     fusionado = True
#     while fusionado and len(picos) > (cantidad_fracciones or 1):
#         fusionado = False
#         for i in range(len(picos) - 1):
#             a, b = picos[i], picos[i + 1]
#             valle = suave[a:b + 1].min()
#             if valle >= FUSION_VALLE * min(suave[a], suave[b]):
#                 picos.pop(i if suave[a] < suave[b] else i + 1)
#                 fusionado = True
#                 break

#     # Si se especificó 4, 5 o 6 fracciones y hay más candidatos, nos quedamos
#     # con los N de mayor prominencia, ordenados de izquierda a derecha.
#     if cantidad_fracciones and len(picos) > cantidad_fracciones:
#         _, props_filtrados = find_peaks(suave, prominence=0, distance=1)
#         mapa_prom = dict(zip(
#             find_peaks(suave, prominence=0, distance=1)[0],
#             props_filtrados["prominences"],
#         ))
#         mejores = sorted(picos, key=lambda p: mapa_prom.get(p, 0), reverse=True)[:cantidad_fracciones]
#         picos = sorted(mejores)

#     return [int(p) for p in picos]


# # def proponer_limites(perfil: np.ndarray, prominencia_rel: float = PROMINENCIA_REL) -> list[Zona]:
# #     """Divide el perfil en una zona por pico, cortando en el valle entre picos.

# #     Estos cortes reemplazan al bisturí. Son una propuesta: el investigador
# #     puede ajustarlos antes de calcular.
# #     """
# #     ultimo = len(perfil) - 1
# #     picos = detectar_picos(perfil, prominencia_rel)
# #     if not picos:
# #         return [(0, ultimo)]

# #     suave = suavizar(perfil)
# #     valles = [a + int(np.argmin(suave[a:b + 1])) for a, b in zip(picos[:-1], picos[1:])]
# #     cortes = [0] + valles + [ultimo]
# #     return [(cortes[i], cortes[i + 1]) for i in range(len(cortes) - 1)]

# def proponer_limites(
#     perfil: np.ndarray,
#     prominencia_rel: float = PROMINENCIA_REL,
#     cantidad_fracciones: int | None = None,
# ) -> list[Zona]:
#     """Divide el perfil en una zona por pico, cortando en valles y puntos de inflexión."""
#     ultimo = len(perfil) - 1
#     picos = detectar_picos(perfil, prominencia_rel, cantidad_fracciones)
#     if not picos:
#         return [(0, ultimo)]

#     suave = suavizar(perfil)
#     valles = [a + int(np.argmin(suave[a:b + 1])) for a, b in zip(picos[:-1], picos[1:])]
#     cortes = [0] + valles + [ultimo]

#     # Si se pidió una cantidad fija (4, 5 o 6) y faltan cortes (por hombros sin valle),
#     # subdividimos en los puntos de inflexión más marcados de la segunda derivada.
#     if cantidad_fracciones and (len(cortes) - 1) < cantidad_fracciones:
#         d2 = np.gradient(np.gradient(suave))
#         # Los puntos de inflexión/hombros entre bandas corresponden a máximos locales de d2
#         inflexiones, props = find_peaks(d2, prominence=0)
#         margen = max(5, int(len(suave) * DISTANCIA_MIN_REL))

#         candidatos = sorted(
#             zip(inflexiones, props["prominences"]),
#             key=lambda item: item[1],
#             reverse=True,
#         )
#         for pos, _ in candidatos:
#             if (len(cortes) - 1) >= cantidad_fracciones:
#                 break
#             pos = int(pos)
#             # Evitar cortar demasiado cerca de un corte ya existente o de los bordes
#             if all(abs(pos - c) >= margen for c in cortes):
#                 cortes.append(pos)
#                 cortes.sort()

#     return [(cortes[i], cortes[i + 1]) for i in range(len(cortes) - 1)]

"""Detección de límites usando realce local de bandas (sin alterar el perfil de áreas)."""
import numpy as np
from scipy.ndimage import gaussian_filter1d
from scipy.signal import find_peaks

SUAVIZADO_REL = 0.006
DISTANCIA_MIN_REL = 0.032
FUSION_VALLE = 0.94

Zona = tuple[int, int]

# Ventanas anatómicas amplias para no dejar afuera valles reales
RANGOS_ELASTICOS: dict[int, list[tuple[float, float, float]]] = {
    5: [
        (0.10, 0.32, 0.20),  # Albúmina | Alfa 1
        (0.28, 0.54, 0.41),  # Alfa 1   | Alfa 2
        (0.48, 0.74, 0.61),  # Alfa 2   | Beta
        (0.62, 0.92, 0.77),  # Beta     | Gamma (ampliado a 0.62 para agarrar el valle)
    ],
    6: [
        (0.10, 0.30, 0.19),  # Albúmina | Alfa I
        (0.26, 0.50, 0.38),  # Alfa I   | Alfa II
        (0.46, 0.70, 0.58),  # Alfa II  | Beta
        (0.62, 0.86, 0.74),  # Beta     | Gama I
        (0.84, 1.08, 0.96),  # Gama I   | Gama II
    ],
}


def suavizar(perfil: np.ndarray) -> np.ndarray:
    return gaussian_filter1d(perfil, sigma=max(1.5, len(perfil) * SUAVIZADO_REL))


def _realzar_bandas_tenues(suave: np.ndarray) -> np.ndarray:
    n = len(suave)
    envolvente = gaussian_filter1d(suave, sigma=max(8.0, n * 0.07))
    piso = max(float(suave.max()) * 0.02, 1e-6)
    return suave / (envolvente + piso)


def detectar_picos(
    perfil: np.ndarray,
    prominencia_rel: float = 0.04,
    cantidad_fracciones: int | None = None,
) -> list[int]:
    suave = suavizar(perfil)
    max_val = float(suave.max())
    if max_val <= 0:
        return []

    curva_busqueda = _realzar_bandas_tenues(suave)
    ref_max = float(curva_busqueda.max())
    prom = 0.025 if cantidad_fracciones is None else 0.03

    picos, _ = find_peaks(
        curva_busqueda,
        prominence=prom * ref_max,
        distance=max(5, int(len(suave) * DISTANCIA_MIN_REL)),
    )
    picos = list(picos)
    picos = [p for p in picos if suave[p] >= max_val * 0.015]

    limite_fusion = 0.96 if cantidad_fracciones is None else FUSION_VALLE
    fusionado = True
    while fusionado and len(picos) > 1:
        fusionado = False
        for i in range(len(picos) - 1):
            a, b = picos[i], picos[i + 1]
            valle = float(suave[a : b + 1].min())
            if valle >= limite_fusion * min(float(suave[a]), float(suave[b])):
                picos.pop(i if suave[a] < suave[b] else i + 1)
                fusionado = True
                break

    return [int(p) for p in picos]


def _acomodar_corte_en_rango(
    suave: np.ndarray,
    d2: np.ndarray,
    valles_globales: list[int],
    r_ini: int,
    r_fin: int,
    fallback: int,
) -> int:
    r_ini = max(1, min(len(suave) - 2, r_ini))
    r_fin = max(r_ini + 1, min(len(suave) - 1, r_fin))

    # 1. Valle entre picos realzados dentro del rango (prioridad absoluta)
    valles = [v for v in valles_globales if r_ini <= v <= r_fin]
    if valles:
        return int(min(valles, key=lambda idx: suave[idx]))

    # 2. Mínimo local real dentro del rango (donde la curva toca el piso)
    segmento = suave[r_ini : r_fin + 1]
    minimos, _ = find_peaks(-segmento)
    if len(minimos) > 0:
        mejor_min = min(minimos, key=lambda m: segmento[m])
        return int(r_ini + mejor_min)

    # 3. Punto de inflexión solo si no hay pendiente fuerte de subida
    seg_d2 = d2[r_ini : r_fin + 1]
    inflexiones, props = find_peaks(seg_d2, prominence=0)
    if len(inflexiones) > 0:
        mejor_inf = inflexiones[int(np.argmax(props["prominences"]))]
        return int(r_ini + mejor_inf)

    return int(np.clip(fallback, r_ini, r_fin))


def proponer_limites(
    perfil: np.ndarray,
    prominencia_rel: float = 0.04,
    cantidad_fracciones: int | None = None,
) -> list[Zona]:
    n = len(perfil)
    ultimo = n - 1
    if n < 30 or perfil.max() <= 0:
        return [(0, ultimo)]

    suave = suavizar(perfil)
    picos = detectar_picos(perfil, prominencia_rel, cantidad_fracciones)
    valles_globales = [
        a + int(np.argmin(suave[a : b + 1]))
        for a, b in zip(picos[:-1], picos[1:])
    ]

    # Si no se forzó cantidad O si los picos detectados coinciden exactamente
    # con la cantidad pedida, usamos los valles reales directos (cero desvío)
    if cantidad_fracciones not in RANGOS_ELASTICOS or len(picos) == cantidad_fracciones:
        if not picos:
            return [(0, ultimo)]
        cortes = [0] + valles_globales + [ultimo]
        return [(cortes[i], cortes[i + 1]) for i in range(len(cortes) - 1)]

    # Solo usamos las ventanas elásticas cuando faltan o sobran picos
    mitad = max(10, n // 2)
    idx_alb = int(np.argmax(suave[:mitad]))

    inicio_gamma = idx_alb + int((ultimo - idx_alb) * 0.55)
    zona_gamma = suave[inicio_gamma:]
    if zona_gamma.sum() > 0:
        indices = np.arange(inicio_gamma, n)
        idx_gamma = int(np.round(np.sum(indices * zona_gamma) / np.sum(zona_gamma)))
    else:
        idx_gamma = int(idx_alb + (ultimo - idx_alb) * 0.78)

    distancia_ag = max(30, idx_gamma - idx_alb)

    d2 = np.gradient(np.gradient(suave))
    rangos = RANGOS_ELASTICOS[cantidad_fracciones]
    cortes = [0]
    margen_min = max(6, int(distancia_ag * 0.06))

    for min_rf, max_rf, centro_rf in rangos:
        r_ini = idx_alb + int(round(distancia_ag * min_rf))
        r_fin = idx_alb + int(round(distancia_ag * max_rf))
        fallback = idx_alb + int(round(distancia_ag * centro_rf))

        corte = _acomodar_corte_en_rango(
            suave, d2, valles_globales, r_ini, r_fin, fallback
        )
        corte = max(cortes[-1] + margen_min, min(ultimo - margen_min, corte))
        cortes.append(corte)

    cortes.append(ultimo)
    return [(cortes[i], cortes[i + 1]) for i in range(len(cortes) - 1)]
