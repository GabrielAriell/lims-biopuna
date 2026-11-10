"""Punto de entrada del módulo: de los bytes de una imagen a los carriles analizados."""
from .carriles import detectar_carriles
from .densidad import MODO_POR_DEFECTO, a_densidad_optica
from .imagen import Region, cargar_imagen, limitar_region, orientar, recortar
from .modelos import Carril, ResultadoTira
from .perfil import perfil_carril
from .tira import detectar_tira


def analizar_tira(
    datos: bytes,
    region: Region | None = None,
    n_carriles: int | None = None,
    modo: str = MODO_POR_DEFECTO,
    vertical: bool = False,
    invertir: bool = False,
) -> ResultadoTira:
    """Orienta, recorta, detecta los carriles y calcula el perfil de cada uno.

    - region: recorte elegido por el usuario, en coordenadas de la imagen ya
      orientada. Si es None, se detecta la tira sola.
    - n_carriles: fuerza la cantidad de carriles. Si es None, se detectan solos.
    - modo: "gris_invertido" o "absorbancia" (ver densidad.py).
    - vertical / invertir: ver orientar() en imagen.py.
    """
    original = orientar(cargar_imagen(datos), vertical, invertir)
    alto, ancho = original.shape[:2]

    automatico = False
    if region is None:
        region = detectar_tira(original)
        automatico = region is not None
    if region is None:
        region = (0, 0, ancho, alto)
    region = limitar_region(alto, ancho, region)

    recorte = recortar(original, region)
    od = a_densidad_optica(recorte, modo)
    carriles = [
        Carril(ini, fin, perfil_carril(od, ini, fin))
        for ini, fin in detectar_carriles(od, n_carriles)
    ]

    advertencias = []
    if recorte.shape[0] > recorte.shape[1]:
        advertencias.append(
            "La tira parece estar parada (más alta que ancha). Probá con vertical=True."
        )
    return ResultadoTira(
        region=region,
        recorte_automatico=automatico,
        imagen=recorte,
        carriles=carriles,
        advertencias=advertencias,
    )
