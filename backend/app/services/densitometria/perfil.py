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

"""Perfil densitométrico de un carril."""
import numpy as np
from scipy.ndimage import gaussian_filter1d

MARGEN_VERTICAL = 0.25    # se descarta el 25% superior e inferior (franja central limpia)
UMBRAL_VELO_REL = 0.075   # 7.5% de umbral de velo
SIGMA_SUAVIZADO = 3.5     # suavizado tipo densitómetro clínico (elimina ruido granular)


def perfil_carril(od: np.ndarray, fila_ini: int, fila_fin: int) -> np.ndarray:
    """Media por columna del carril con resta de línea base, velo, DO^2.05 y suavizado."""
    margen = int((fila_fin - fila_ini) * MARGEN_VERTICAL)
    franja = od[fila_ini + margen: fila_fin - margen, :]
    perfil_od = franja.mean(axis=0).astype(np.float64)

    ancho = len(perfil_od)
    if ancho == 0:
        return perfil_od

    # Línea base lineal entre el 4% izquierdo y el 4% derecho
    n_izq = max(3, int(ancho * 0.04))
    base_izq = float(perfil_od[:n_izq].mean())

    idx_der = int(ancho * 0.96)
    base_der = float(perfil_od[idx_der:].mean()) if idx_der < ancho else base_izq

    t = np.linspace(0.0, 1.0, ancho)
    linea_base = base_izq + t * (base_der - base_izq)
    sin_fondo = np.maximum(0.0, perfil_od - linea_base)

    # Umbral de velo (7.5%) + corrección de reflectancia (DO / 10)^2.05 * 10
    max_val = float(sin_fondo.max())
    limpia = np.maximum(0.0, sin_fondo - max_val * UMBRAL_VELO_REL)
    curva = np.power(limpia / 10.0, 2.05) * 10.0

    # Suavizado Gaussiano ancho para curvas limpias sin dientes de sierra
    return gaussian_filter1d(curva, sigma=SIGMA_SUAVIZADO, mode="nearest")