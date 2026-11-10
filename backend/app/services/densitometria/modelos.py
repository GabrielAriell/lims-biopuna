"""Tipos de datos del módulo de densitometría."""
from dataclasses import dataclass

import numpy as np


@dataclass
class Carril:
    """Un carril de la tira: sus filas en el recorte y su perfil de densidad."""

    fila_ini: int
    fila_fin: int
    perfil: np.ndarray  # un valor de densidad óptica por columna (eje de migración)


@dataclass
class ResultadoTira:
    """Resultado de analizar una imagen."""

    region: tuple[int, int, int, int]  # (x, y, ancho, alto) usada, en la imagen ya orientada
    recorte_automatico: bool           # True si lo detectó el programa, False si lo eligió el usuario
    imagen: np.ndarray                 # el recorte analizado (BGR), ya orientado
    carriles: list[Carril]
    advertencias: list[str]            # avisos para el usuario (por ejemplo, tira parada)


@dataclass
class Fraccion:
    """Una fracción proteica: su zona en el perfil y su cuantificación."""

    nombre: str
    inicio: int
    fin: int
    pico: int                            # columna del máximo dentro de la zona
    area: float                          # área bajo la curva (regla del trapecio)
    porcentaje: float                    # % respecto del área total
    concentracion_g_dl: float | None     # solo si se informaron las proteínas totales


@dataclass
class ResultadoFracciones:
    """Resultado de cuantificar un carril."""

    fracciones: list[Fraccion]
    nombres_asignados: bool              # False si no se detectaron exactamente 5 fracciones
    relacion_ag: float | None            # Albúmina / Globulinas (solo con 5 fracciones)
    advertencias: list[str]
