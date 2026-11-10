"""Esquemas de campañas de muestreo y muestras de animales."""
from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

Especie = Literal["Llama", "Vicuña", "Ovino"]
EstadoMuestra = Literal["verde", "amarillo", "rojo", "procesada"]


class CampanaIn(BaseModel):
    """Datos que carga el investigador para abrir una campaña.

    Modelo recomendado: provincia/departamento (catálogo) + localidad/paraje
    como texto libre. Se mantiene ``localidad_puna`` por compatibilidad con
    clientes viejos y como respaldo legible.
    """

    id_departamento: int | None = Field(None, gt=0)
    localidad_detalle: str | None = Field(None, max_length=200)
    # Compatibilidad: algunos clientes todavía envían solo este campo.
    localidad_puna: str | None = Field(None, max_length=200)
    fecha_salida: date
    convenio_inta: bool = False
    observaciones: str | None = Field(None, max_length=2000)

    @field_validator("localidad_detalle", "localidad_puna")
    @classmethod
    def limpiar_texto(cls, valor: str | None) -> str | None:
        if valor is None:
            return None
        limpio = valor.strip()
        return limpio or None

    @field_validator("observaciones")
    @classmethod
    def limpiar_observaciones(cls, valor: str | None) -> str | None:
        if valor is None:
            return None
        limpio = valor.strip()
        return limpio or None

    @model_validator(mode="after")
    def validar_ubicacion(self) -> "CampanaIn":
        if self.id_departamento is None and not self.localidad_puna:
            raise ValueError(
                "Indicá un departamento o, al menos, una localidad de referencia"
            )
        return self


class ProvinciaOut(BaseModel):
    id_provincia: int
    nombre: str


class DepartamentoOut(BaseModel):
    id_departamento: int
    id_provincia: int
    nombre: str
    provincia: str | None = None


class CampanaOut(BaseModel):
    id_campana: int
    # Texto legible para compatibilidad con la UI/listados existentes.
    localidad_puna: str
    id_departamento: int | None = None
    departamento: str | None = None
    id_provincia: int | None = None
    provincia: str | None = None
    localidad_detalle: str | None = None
    fecha_salida: date
    convenio_inta: bool
    observaciones: str | None
    total_muestras: int = 0
    # Se completan recién después de ejecutar 004_auditoria.sql.
    creado_por: UUID | None = None
    creado_en: datetime | None = None


class MuestraIn(BaseModel):
    """Datos de una muestra extraída en territorio."""

    id_campana: int = Field(gt=0)
    codigo_animal: str = Field(min_length=1, max_length=80)
    especie: Especie
    fecha_hora_extraccion: datetime
    url_foto_campo: str | None = Field(None, max_length=2048)

    @field_validator("codigo_animal")
    @classmethod
    def limpiar_codigo(cls, valor: str) -> str:
        limpio = valor.strip()
        if not limpio:
            raise ValueError("El código del animal no puede quedar vacío")
        return limpio

    @field_validator("url_foto_campo")
    @classmethod
    def limpiar_url(cls, valor: str | None) -> str | None:
        if valor is None:
            return None
        limpio = valor.strip()
        return limpio or None


class MuestraOut(BaseModel):
    """Fila de la vista ``muestra_con_estado`` + datos de su campaña."""

    id_muestra: int
    id_campana: int
    codigo_animal: str
    especie: Especie
    fecha_hora_extraccion: datetime
    url_foto_campo: str | None
    primera_corrida: datetime | None
    horas_transcurridas: float
    estado_48h: EstadoMuestra
    localidad_puna: str
    fecha_salida: date
