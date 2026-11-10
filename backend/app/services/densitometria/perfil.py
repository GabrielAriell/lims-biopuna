"""Perfil densitométrico de un carril."""
import numpy as np

MARGEN_VERTICAL = 0.2     # se descarta el 20% superior e inferior (bordes de la tira)
PERCENTIL_BASE = 2


def perfil_carril(od: np.ndarray, fila_ini: int, fila_fin: int) -> np.ndarray:
    """Media por columna del carril, con la línea base restada."""
    margen = int((fila_fin - fila_ini) * MARGEN_VERTICAL)
    franja = od[fila_ini + margen: fila_fin - margen, :]
    perfil = franja.mean(axis=0)
    linea_base = np.percentile(perfil, PERCENTIL_BASE)
    return np.clip(perfil - linea_base, 0.0, None)
