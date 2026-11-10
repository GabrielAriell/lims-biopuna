"""Cuantificación de fracciones proteicas a partir del perfil y sus límites."""
import numpy as np
from scipy.integrate import trapezoid

from .modelos import Fraccion, ResultadoFracciones
from .picos import Zona

# Nombres según la cantidad de fracciones detectadas (de la albúmina a la gamma).
# 6 es la tabla del informe de la cátedra; 5 es el esquema clásico.
ESQUEMAS_FRACCIONES = {
    5: ("Albumina", "Alfa1", "Alfa2", "Beta", "Gamma"),
    6: ("Albumina", "Alfa1", "Alfa2", "Beta1", "Beta2", "Gamma"),
}
PT_MAX_G_DL = 20.0       # mismo rango que valida la base de datos


def _validar_zonas(zonas: list[Zona], largo: int) -> None:
    if not zonas:
        raise ValueError("Hace falta al menos una zona")
    previo = -1
    for inicio, fin in zonas:
        if not (0 <= inicio < fin < largo):
            raise ValueError(f"Zona fuera del perfil: ({inicio}, {fin})")
        if inicio < previo:
            raise ValueError("Las zonas deben estar ordenadas y no superponerse")
        previo = fin


def calcular_fracciones(
    perfil: np.ndarray,
    zonas: list[Zona],
    proteinas_totales: float | None = None,
) -> ResultadoFracciones:
    """Integra cada zona y calcula porcentajes, concentraciones y relación A/G.

    - Porcentaje = área de la fracción / área total * 100.
    - Concentración (g/dL) = porcentaje * proteínas totales.
    Los nombres solo se asignan si la cantidad de zonas coincide con un esquema
    conocido (5 o 6); en otro caso se advierte para que el investigador
    revise los límites.
    """
    _validar_zonas(zonas, len(perfil))
    if proteinas_totales is not None and not (0 < proteinas_totales <= PT_MAX_G_DL):
        raise ValueError(f"Las proteínas totales deben estar entre 0 y {PT_MAX_G_DL} g/dL")

    areas = [float(trapezoid(perfil[i:f + 1])) for i, f in zonas]
    total = sum(areas)
    if total <= 0:
        raise ValueError("El perfil no tiene señal para cuantificar")

    asignados = len(zonas) in ESQUEMAS_FRACCIONES
    nombres = list(ESQUEMAS_FRACCIONES[len(zonas)]) if asignados else [f"Fraccion {k}" for k in range(1, len(zonas) + 1)]

    fracciones = []
    for nombre, (inicio, fin), area in zip(nombres, zonas, areas):
        porcentaje = 100.0 * area / total
        fracciones.append(Fraccion(
            nombre=nombre,
            inicio=inicio,
            fin=fin,
            pico=inicio + int(np.argmax(perfil[inicio:fin + 1])),
            area=area,
            porcentaje=porcentaje,
            concentracion_g_dl=None if proteinas_totales is None else proteinas_totales * porcentaje / 100.0,
        ))

    relacion_ag = None
    advertencias = []
    if asignados:
        globulinas = sum(areas[1:])
        relacion_ag = areas[0] / globulinas if globulinas > 0 else None
    else:
        advertencias.append(
            f"Se detectaron {len(zonas)} fracciones y se esperaban 5 o 6. "
            "Revisá los límites antes de asignar nombres."
        )
    return ResultadoFracciones(fracciones, asignados, relacion_ag, advertencias)
