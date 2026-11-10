"""Dependencias compartidas por los endpoints.

La sesión se valida contra Supabase Auth en cada llamada: el backend no
confía en un id enviado por el navegador.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Header, HTTPException

from app.services import auth


@dataclass
class UsuarioActual:
    """Investigador autenticado y el token con el que llegó."""

    id: str
    nombre: str
    email: str
    rol_sistema: str
    token: str


def usuario_actual(
    authorization: Annotated[str | None, Header()] = None,
) -> UsuarioActual:
    """Lee el token Bearer y devuelve el perfil del investigador."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            401,
            "Falta iniciar sesión",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(401, "El token de sesión está vacío")

    try:
        perfil = auth.usuario_de_token(token)
    except auth.AuthError as error:
        raise HTTPException(error.status, str(error)) from error

    return UsuarioActual(**perfil, token=token)


def exigir_escritura(
    usuario: Annotated[UsuarioActual, Depends(usuario_actual)],
) -> UsuarioActual:
    """Solo admin e investigador pueden crear registros (igual que las RLS)."""
    if usuario.rol_sistema not in ("admin", "investigador"):
        raise HTTPException(
            403,
            "Tu usuario es de solo lectura: no puede crear registros",
        )
    return usuario
