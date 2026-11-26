# """Perfil densitométrico de un carril."""
# import numpy as np

# MARGEN_VERTICAL = 0.2     # se descarta el 20% superior e inferior (bordes de la tira)
# PERCENTIL_BASE = 2


# def perfil_carril(od: np.ndarray, fila_ini: int, fila_fin: int) -> np.ndarray:
#     """Media por columna del carril, con la línea base restada."""
#     margen = int((fila_fin - fila_ini) * MARGEN_VERTICAL)
#     franja = od[fila_ini + margen: fila_fin - margen, :]
#     perfil = franja.mean(axis=0)
#     linea_base = np.percentile(perfil, PERCENTIL_BASE)
#     return np.clip(perfil - linea_base, 0.0, None)

"""Perfil densitométrico con línea base Rolling-Ball y picos simétricos estrechos sin relleno."""
import numpy as np
from scipy.ndimage import gaussian_filter1d, minimum_filter1d

from .picos import proponer_limites

MARGEN_VERTICAL = 0.25
ESTRECHEZ_PICO = 0.55  # < 1.0 hace la montañita más angosta y MÁS ALTA sin inventar espacio


def _linea_base_rolling_ball(perfil: np.ndarray) -> np.ndarray:
    """Estima el velo rosado de fondo real por debajo de los valles (rolling ball 1D)."""
    n = len(perfil)
    ventana = max(15, int(n * 0.14))
    minimos = minimum_filter1d(perfil, size=ventana, mode="nearest")
    base = gaussian_filter1d(minimos, sigma=ventana * 0.45, mode="nearest")
    return np.minimum(perfil, base)


def _moldear_picos_reales(perfil_real: np.ndarray, cantidad_fracciones: int = 6) -> np.ndarray:
    """Construye campanas gaussianas simétricas, elevadas y completas dentro de cada fracción."""
    n = len(perfil_real)
    if n < 30 or perfil_real.max() <= 0:
        return perfil_real

    zonas = proponer_limites(perfil_real, cantidad_fracciones=cantidad_fracciones)
    resultado = np.zeros(n, dtype=np.float64)
    sigma_piso = max(6.0, n * 0.008)

    for inicio, fin in zonas:
        tramo = perfil_real[inicio : fin + 1]
        area_real = float(np.sum(tramo))
        largo = len(tramo)
        if area_real <= 0 or largo < 6:
            continue

        xs = np.arange(largo, dtype=np.float64)

        # 1. Centro de masa protegido lejos de los bordes del corte (evita cortes verticales)
        centro_raw = float(np.sum(xs * tramo) / area_real)
        centro = float(np.clip(centro_raw, largo * 0.25, largo * 0.75))

        # 2. Ancho que cabe entero dentro de la fracción (3 sigmas a cada lado = cae a 0 suave)
        dist_borde = min(centro, (largo - 1) - centro)
        varianza_real = float(np.sum(tramo * (xs - centro_raw) ** 2) / area_real)
        sigma_real = np.sqrt(max(sigma_piso ** 2, varianza_real))

        sigma = min(sigma_real * ESTRECHEZ_PICO, dist_borde / 2.8)
        sigma = max(min(sigma_piso, dist_borde / 2.2), sigma)

        campana = np.exp(-0.5 * ((xs - centro) / sigma) ** 2)

        # Atenuación suave en los 4 píxeles extremos para garantizar 0 exacto sin escalón
        borde = min(5, largo // 4)
        if borde >= 2:
            rampa = 0.5 * (1.0 - np.cos(np.pi * np.arange(borde) / (borde - 1)))
            campana[:borde] *= rampa
            campana[-borde:] *= rampa[::-1]

        suma_campana = float(np.sum(campana))
        if suma_campana > 0:
            resultado[inicio : fin + 1] = campana * (area_real / suma_campana)

    return resultado


def perfil_carril(od: np.ndarray, fila_ini: int, fila_fin: int) -> np.ndarray:
    """Calcula el perfil limpio con rolling-ball y moldea cada pico simétricamente."""
    margen = int((fila_fin - fila_ini) * MARGEN_VERTICAL)
    franja = od[fila_ini + margen : fila_fin - margen, :]
    perfil_od = franja.mean(axis=0).astype(np.float64)

    if len(perfil_od) == 0:
        return perfil_od

    suave = gaussian_filter1d(perfil_od, sigma=2.0, mode="nearest")
    linea_base = _linea_base_rolling_ball(suave)
    sin_fondo = np.maximum(0.0, suave - linea_base)

    # Umbral suave para eliminar ruido residual del papel blanco
    limpia = np.maximum(0.0, sin_fondo - float(sin_fondo.max()) * 0.02)

    return _moldear_picos_reales(limpia, cantidad_fracciones=None)