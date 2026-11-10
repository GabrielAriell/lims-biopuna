"""Endpoints de investigadores.

El ensayo ya se atribuye automáticamente al usuario logueado. Esta lista
queda disponible para futuros selectores de "responsable distinto" y solo la
puede consultar alguien con sesión iniciada.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import UsuarioActual, usuario_actual
from app.schemas.ensayos import InvestigadorOut
from app.services import supabase_rest

router = APIRouter(prefix="/investigadores", tags=["investigadores"])

COLUMNAS = "id_investigador,nombre,email,rol_sistema"


@router.get("", response_model=list[InvestigadorOut])
def listar_investigadores(
    _usuario: Annotated[UsuarioActual, Depends(usuario_actual)],
):
    try:
        return supabase_rest.seleccionar(
            "investigador", columnas=COLUMNAS, orden="nombre.asc"
        )
    except supabase_rest.SupabaseNoConfigurado as error:
        raise HTTPException(503, str(error)) from error
    except supabase_rest.SupabaseError as error:
        raise HTTPException(error.status, str(error)) from error
