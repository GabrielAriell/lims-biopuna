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
    modo: str = MODO_POR_DEFECTO,
    vertical: bool = False,
    invertir: bool = False,
) -> ResultadoTira:
    """Orienta, recorta y calcula el perfil de la tira.

    Un ensayo equivale a una sola tira, así que todo el recorte se analiza como
    un único carril. Si se detectan varias tiras en la imagen, se avisa para que
    el usuario recorte la que quiere medir.

    - region: recorte elegido por el usuario, en coordenadas de la imagen ya
      orientada. Si es None, se detecta la tira sola.
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
    alto_recorte = od.shape[0]
    carriles = [Carril(0, alto_recorte, perfil_carril(od, 0, alto_recorte))]

    advertencias = []
    if len(detectar_carriles(od)) > 1:
        advertencias.append(
            "Se detectaron varias tiras en la imagen. Se analiza todo el recorte "
            "como una sola tira; recortá la tira que querés medir para mayor precisión."
        )
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
