"""Esquemas de administración de usuarios/investigadores."""
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

RolSistema = Literal["admin", "investigador", "lectura"]


class UsuarioAdminOut(BaseModel):
    id_investigador: UUID
    nombre: str
    email: str
    rol_sistema: str


class UsuarioCrearIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=8, max_length=200)
    rol_sistema: RolSistema = "investigador"

    @field_validator("nombre")
    @classmethod
    def limpiar_nombre(cls, valor: str) -> str:
        limpio = valor.strip()
        if not limpio:
            raise ValueError("El nombre no puede estar vacío")
        return limpio

    @field_validator("email")
    @classmethod
    def normalizar_email(cls, valor: str) -> str:
        limpio = valor.strip().lower()
        if "@" not in limpio:
            raise ValueError("El correo no es válido")
        return limpio


class UsuarioActualizarIn(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=120)
    rol_sistema: RolSistema | None = None

    @field_validator("nombre")
    @classmethod
    def limpiar_nombre(cls, valor: str | None) -> str | None:
        if valor is None:
            return None
        limpio = valor.strip()
        if not limpio:
            raise ValueError("El nombre no puede estar vacío")
        return limpio
