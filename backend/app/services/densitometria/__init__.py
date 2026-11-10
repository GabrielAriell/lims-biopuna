"""Densitometría óptica digital (lógica pura: sin FastAPI ni base de datos)."""
from .carriles import detectar_carriles
from .densidad import a_densidad_optica
from .fracciones import calcular_fracciones
from .imagen import cargar_imagen, limitar_region, recortar
from .modelos import Carril, Fraccion, ResultadoFracciones, ResultadoTira
from .perfil import perfil_carril
from .picos import detectar_picos, proponer_limites
from .pipeline import analizar_tira
from .tira import detectar_tira

__all__ = [
    "Carril",
    "Fraccion",
    "ResultadoFracciones",
    "ResultadoTira",
    "analizar_tira",
    "a_densidad_optica",
    "calcular_fracciones",
    "cargar_imagen",
    "detectar_carriles",
    "detectar_picos",
    "detectar_tira",
    "limitar_region",
    "perfil_carril",
    "proponer_limites",
    "recortar",
]
