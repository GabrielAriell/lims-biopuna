"""Orquesta el análisis completo de una tira: carriles, límites propuestos y fracciones.

No conoce FastAPI ni la base de datos: recibe bytes y parámetros, devuelve datos.
"""
import base64
from dataclasses import dataclass, field

import cv2
import numpy as np

from app.services.densitometria import (
    ResultadoFracciones,
    ResultadoTira,
    analizar_tira,
    calcular_fracciones,
    proponer_limites,
)

Region = tuple[int, int, int, int]  # (x, y, ancho, alto)


@dataclass
class CarrilAnalizado:
    """Un carril con su perfil y las fracciones propuestas (o el error si falló)."""

    fila_ini: int
    fila_fin: int
    perfil: np.ndarray
    calculo: ResultadoFracciones | None = None
    error: str | None = None


@dataclass
class AnalisisTira:
    tira: ResultadoTira
    carriles: list[CarrilAnalizado] = field(default_factory=list)


def analizar(
    datos: bytes,
    *,
    proteinas_totales: float | None = None,
    prominencia: float = 0.05,
    modo: str = "gris_invertido",
    n_carriles: int | None = None,
    region: Region | None = None,
    vertical: bool = False,
    invertir: bool = False,
) -> AnalisisTira:
    """Analiza la imagen y propone las fracciones de cada carril. No guarda nada."""
    tira = analizar_tira(
        datos,
        region=region,
        n_carriles=n_carriles,
        modo=modo,
        vertical=vertical,
        invertir=invertir,
    )
    resultado = AnalisisTira(tira=tira)
    for carril in tira.carriles:
        item = CarrilAnalizado(carril.fila_ini, carril.fila_fin, carril.perfil)
        try:
            zonas = proponer_limites(carril.perfil, prominencia)
            item.calculo = calcular_fracciones(carril.perfil, zonas, proteinas_totales)
        except ValueError as error:  # un carril malo no debe tirar abajo a los demás
            item.error = str(error)
        resultado.carriles.append(item)
    return resultado


def imagen_a_data_url(imagen: np.ndarray, calidad: int = 85) -> str:
    """Codifica el recorte (BGR) como JPEG en base64, listo para un <img src=...>."""
    ok, buffer = cv2.imencode(".jpg", imagen, [cv2.IMWRITE_JPEG_QUALITY, calidad])
    if not ok:
        raise ValueError("No se pudo codificar la imagen de vista previa")
    return "data:image/jpeg;base64," + base64.b64encode(buffer.tobytes()).decode("ascii")
