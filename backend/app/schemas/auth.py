"""Esquemas de login y sesión."""
from pydantic import BaseModel, Field, field_validator


class LoginIn(BaseModel):
    """Credenciales que carga el investigador en la pantalla de login."""

    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=1, max_length=200)

    @field_validator("email")
    @classmethod
    def limpiar_email(cls, valor: str) -> str:
        limpio = valor.strip()
        if "@" not in limpio:
            raise ValueError("El correo no es válido")
        return limpio


class RefreshIn(BaseModel):
    """Token de refresco para renovar la sesión sin contraseña."""

    refresh_token: str = Field(min_length=1, max_length=4000)


class UsuarioOut(BaseModel):
    id: str
    nombre: str
    email: str
    rol_sistema: str


class SesionOut(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    token_type: str = "bearer"
    usuario: UsuarioOut
