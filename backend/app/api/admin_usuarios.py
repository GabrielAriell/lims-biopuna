"""Endpoints de administración de usuarios/investigadores (solo admin)."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import UsuarioActual, exigir_admin
from app.schemas.usuarios import UsuarioActualizarIn, UsuarioAdminOut, UsuarioCrearIn
from app.services import supabase_rest, usuarios_admin

router = APIRouter(prefix="/admin/usuarios", tags=["admin-usuarios"])


@router.get("", response_model=list[UsuarioAdminOut])
def listar_usuarios(
    _admin: Annotated[UsuarioActual, Depends(exigir_admin)],
):
    try:
        return usuarios_admin.listar()
    except supabase_rest.SupabaseNoConfigurado as error:
        raise HTTPException(503, str(error)) from error
    except supabase_rest.SupabaseError as error:
        raise HTTPException(error.status, str(error)) from error


@router.post("", response_model=UsuarioAdminOut, status_code=201)
def crear_usuario(
    datos: UsuarioCrearIn,
    _admin: Annotated[UsuarioActual, Depends(exigir_admin)],
):
    try:
        return usuarios_admin.crear(datos)
    except usuarios_admin.UsuarioAdminError as error:
        raise HTTPException(error.status, str(error)) from error
    except supabase_rest.SupabaseNoConfigurado as error:
        raise HTTPException(503, str(error)) from error
    except supabase_rest.SupabaseError as error:
        raise HTTPException(error.status, str(error)) from error


@router.patch("/{id_usuario}", response_model=UsuarioAdminOut)
def actualizar_usuario(
    id_usuario: UUID,
    datos: UsuarioActualizarIn,
    admin: Annotated[UsuarioActual, Depends(exigir_admin)],
):
    try:
        return usuarios_admin.actualizar(str(id_usuario), datos, admin.id)
    except usuarios_admin.UsuarioAdminError as error:
        raise HTTPException(error.status, str(error)) from error
    except supabase_rest.SupabaseNoConfigurado as error:
        raise HTTPException(503, str(error)) from error
    except supabase_rest.SupabaseError as error:
        raise HTTPException(error.status, str(error)) from error
