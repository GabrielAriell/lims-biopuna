"""Cuantificación de fracciones proteicas a partir del perfil y sus límites."""
import numpy as np
from scipy.integrate import trapezoid

from .modelos import Fraccion, ResultadoFracciones
from .picos import Zona

# Nombres clásicos conservados por compatibilidad (datos históricos/rangos).
# La propuesta automática usa nombres genéricos: el investigador puede renombrar.
ESQUEMAS_FRACCIONES = {
    5: ("Albumina", "Alfa1", "Alfa2", "Beta", "Gamma"),
    6: ("Albumina", "Alfa1", "Alfa2", "Beta1", "Beta2", "Gamma"),
}
PT_MAX_G_DL = 20.0  # mismo rango que valida la base de datos


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
    Si se detectan 5 o 6 fracciones se asignan automáticamente los nombres
    clásicos (Albúmina, Alfa1, Alfa2, Beta/Gamma o Beta1/Beta2); en cualquier
    otro caso se usan nombres genéricos (Fracción 1..N). En ambos casos el
    investigador puede editarlos.
    La relación A/G se calcula automáticamente: en esquemas conocidos se toma la
    primera fracción (Albúmina) sobre el resto; en caso contrario se toma la
    franja de mayor área como Albúmina sobre el resto.
    """
    _validar_zonas(zonas, len(perfil))
    if proteinas_totales is not None and not (0 < proteinas_totales <= PT_MAX_G_DL):
        raise ValueError(f"Las proteínas totales deben estar entre 0 y {PT_MAX_G_DL} g/dL")

    areas = [float(trapezoid(perfil[i : f + 1])) for i, f in zonas]
    total = sum(areas)
    if total <= 0:
        raise ValueError("El perfil no tiene señal para cuantificar")

    esquema_conocido = len(zonas) in ESQUEMAS_FRACCIONES
    if esquema_conocido:
        nombres = list(ESQUEMAS_FRACCIONES[len(zonas)])
    else:
        nombres = [f"Fracción {k}" for k in range(1, len(zonas) + 1)]

    fracciones = []
    for nombre, (inicio, fin), area in zip(nombres, zonas, areas):
        porcentaje = 100.0 * area / total
        fracciones.append(
            Fraccion(
                nombre=nombre,
                inicio=inicio,
                fin=fin,
                pico=inicio + int(np.argmax(perfil[inicio : fin + 1])),
                area=area,
                porcentaje=porcentaje,
                concentracion_g_dl=(
                    None if proteinas_totales is None else proteinas_totales * porcentaje / 100.0
                ),
            )
        )

    relacion_ag = None
    if len(areas) >= 2:
        if esquema_conocido:
            idx_albumina = 0
        else:
            idx_albumina = int(max(range(len(areas)), key=lambda i: areas[i]))
        globulinas = total - areas[idx_albumina]
        relacion_ag = areas[idx_albumina] / globulinas if globulinas > 0 else None

    return ResultadoFracciones(fracciones, esquema_conocido, relacion_ag, [])
