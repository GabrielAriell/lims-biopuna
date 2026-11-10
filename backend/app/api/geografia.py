"""Catálogos geográficos (provincias y departamentos) para campañas Puna."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import UsuarioActual, usuario_actual
from app.schemas.muestras import DepartamentoOut, ProvinciaOut
from app.services import supabase_rest

router = APIRouter(prefix="/geografia", tags=["geografia"])


@router.get("/provincias", response_model=list[ProvinciaOut])
def listar_provincias(
    _usuario: Annotated[UsuarioActual, Depends(usuario_actual)],
):
    try:
        filas = supabase_rest.seleccionar(
            "provincia",
            columnas="id_provincia,nombre",
            orden="nombre.asc",
            limite=100,
        )
    except (supabase_rest.SupabaseNoConfigurado, supabase_rest.SupabaseError) as error:
        raise HTTPException(getattr(error, "status", 502), str(error)) from error
    return [ProvinciaOut(**f) for f in filas]


@router.get("/departamentos", response_model=list[DepartamentoOut])
def listar_departamentos(
    _usuario: Annotated[UsuarioActual, Depends(usuario_actual)],
    id_provincia: int | None = Query(None, gt=0),
):
    filtros = []
    if id_provincia is not None:
        filtros.append(("id_provincia", f"eq.{id_provincia}"))
    try:
        deps = supabase_rest.seleccionar(
            "departamento",
            columnas="id_departamento,id_provincia,nombre",
            filtros=filtros,
            orden="nombre.asc",
            limite=500,
        )
        provs = supabase_rest.seleccionar(
            "provincia", columnas="id_provincia,nombre", limite=100
        )
    except (supabase_rest.SupabaseNoConfigurado, supabase_rest.SupabaseError) as error:
        raise HTTPException(getattr(error, "status", 502), str(error)) from error

    nombres = {p["id_provincia"]: p["nombre"] for p in provs}
    return [
        DepartamentoOut(
            **d, provincia=nombres.get(d["id_provincia"])
        )
        for d in deps
    ]
