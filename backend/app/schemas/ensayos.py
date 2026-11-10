"""Esquemas del guardado de ensayos electroforéticos."""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

MetodoLectura = Literal["digital_opencv", "espectrofotometro"]


class CarrilIn(BaseModel):
    """Perfil de un carril y los límites que confirmó el investigador."""

    perfil: list[float] = Field(min_length=2, max_length=20_000)
    # Zonas (inicio, fin) inclusivas, en columnas del perfil.
    zonas: list[tuple[int, int]] = Field(min_length=1, max_length=20)


class EnsayoIn(BaseModel):
    """Todo lo necesario para guardar un ensayo, salvo la imagen.

    El investigador no viaja en el formulario: sale de la sesión.
    """

    id_muestra: int = Field(gt=0)
    proteinas_totales: float = Field(gt=0, le=20)
    fecha_corrida: datetime | None = None
    metodo_lectura: MetodoLectura = "digital_opencv"
    carriles: list[CarrilIn] = Field(min_length=1, max_length=20)


class FraccionGuardadaOut(BaseModel):
    nombre_fraccion: str
    area_integrada: float
    porcentaje_relativo: float
    concentracion_g_dl: float


class EnsayoOut(BaseModel):
    id_ensayo: int
    id_muestra: int
    id_investigador: UUID
    investigador_nombre: str | None = None
    fecha_corrida: datetime
    proteinas_totales_g_dl: float
    url_imagen_tira: str | None
    metodo_lectura: str
    creado_por: UUID | None = None
    creado_en: datetime | None = None
    fracciones: list[FraccionGuardadaOut] = []


class InvestigadorOut(BaseModel):
    id_investigador: UUID
    nombre: str
    email: str
    rol_sistema: str
