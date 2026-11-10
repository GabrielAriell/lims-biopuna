"""Recalcula las fracciones con los límites confirmados por el investigador.

No conoce la imagen, FastAPI ni la base de datos: recibe un perfil ya calculado
y las zonas elegidas, y devuelve el mismo tipo que el análisis automático.
Así la matemática vive en un solo lugar (densitometria.fracciones).
"""
from collections.abc import Sequence

import numpy as np

from app.services.densitometria import ResultadoFracciones, calcular_fracciones
from app.services.densitometria.picos import Zona

MAX_COLUMNAS = 20_000
MAX_ZONAS = 20


def recalcular(
    perfil: Sequence[float],
    zonas: Sequence[Zona],
    proteinas_totales: float | None = None,
) -> ResultadoFracciones:
    """Valida el perfil y las zonas, y delega el cálculo en densitometría.

    Las zonas son (inicio, fin) inclusivos, en columnas del perfil, tal como
    las devuelve proponer_limites(). Se esperan ordenadas y sin superponerse.
    """
    arreglo = np.asarray(perfil, dtype=float)
    if arreglo.ndim != 1 or arreglo.size < 2:
        raise ValueError("El perfil debe tener al menos dos columnas")
    if arreglo.size > MAX_COLUMNAS:
        raise ValueError(f"El perfil supera las {MAX_COLUMNAS} columnas")
    if not np.all(np.isfinite(arreglo)):
        raise ValueError("El perfil contiene valores no finitos")
    if len(zonas) > MAX_ZONAS:
        raise ValueError(f"No se pueden definir más de {MAX_ZONAS} zonas")

    return calcular_fracciones(arreglo, list(zonas), proteinas_totales)
