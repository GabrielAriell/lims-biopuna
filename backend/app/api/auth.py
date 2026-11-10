"""Endpoints de login, sesión y cierre de sesión.

El frontend no habla directamente con Supabase Auth: este backend hace de
intermediario con la secret key. Así la clave nunca llega al navegador.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response

from app.api.deps import UsuarioActual, usuario_actual
from app.schemas.auth import LoginIn, RefreshIn, SesionOut, UsuarioOut
from app.services import auth

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=SesionOut)
def login(datos: LoginIn):
    """Valida correo y contraseña y devuelve la sesión."""
    try:
        return auth.iniciar_sesion(datos.email, datos.password)
    except auth.AuthError as error:
        raise HTTPException(error.status, str(error)) from error


@router.post("/refresh", response_model=SesionOut)
def refresh(datos: RefreshIn):
    """Renueva el access token con el refresh token guardado."""
    try:
        return auth.refrescar(datos.refresh_token)
    except auth.AuthError as error:
        raise HTTPException(error.status, str(error)) from error


@router.get("/me", response_model=UsuarioOut)
def me(usuario: Annotated[UsuarioActual, Depends(usuario_actual)]):
    """Perfil del usuario dueño del token."""
    return UsuarioOut(
        id=usuario.id,
        nombre=usuario.nombre,
        email=usuario.email,
        rol_sistema=usuario.rol_sistema,
    )


@router.post("/logout", status_code=204)
def logout(usuario: Annotated[UsuarioActual, Depends(usuario_actual)]):
    """Revoca el token en Supabase."""
    try:
        auth.cerrar_sesion(usuario.token)
    except auth.AuthError as error:
        raise HTTPException(error.status, str(error)) from error
    return Response(status_code=204)
