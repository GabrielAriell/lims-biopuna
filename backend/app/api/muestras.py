"""Endpoints de campañas de muestreo y muestras de animales.

El semáforo de 48 horas no se guarda: lo calcula la vista
``muestra_con_estado`` cada vez que se consulta.
"""
from collections import Counter
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import UsuarioActual, exigir_escritura, usuario_actual
from app.schemas.muestras import (
    CampanaIn,
    CampanaOut,
    EstadoMuestra,
    MuestraIn,
    MuestraOut,
)
from app.services import supabase_rest

router = APIRouter(tags=["muestras"])

COLUMNAS_CAMPANA_BASE = (
    "id_campana,localidad_puna,fecha_salida,convenio_inta,observaciones"
)
COLUMNAS_CAMPANA_GEO = (
    COLUMNAS_CAMPANA_BASE + ",id_departamento,localidad_detalle"
)


def _http_error(error: Exception) -> HTTPException:
    """Convierte los errores del cliente de Supabase en respuestas HTTP."""
    if isinstance(error, supabase_rest.SupabaseNoConfigurado):
        return HTTPException(503, str(error))
    if isinstance(error, supabase_rest.SupabaseError):
        return HTTPException(error.status, str(error))
    return HTTPException(502, "Error inesperado al hablar con Supabase")


def _error_muestra(error: supabase_rest.SupabaseError) -> HTTPException:
    """Mensajes claros para los choques más comunes al crear una muestra."""
    if error.codigo == "23505":
        return HTTPException(409, "Ya existe una muestra con ese código en la campaña")
    if error.codigo == "23503":
        return HTTPException(422, "La campaña o referencia elegida no existe")
    return _http_error(error)


def _columnas_campana() -> str:
    """Incluye columnas de geografía solo si la migración 005 ya corrió."""
    try:
        cols = supabase_rest.columnas("campana_territorio")
    except supabase_rest.SupabaseError:
        cols = set()
    if {"id_departamento", "localidad_detalle"}.issubset(cols):
        return COLUMNAS_CAMPANA_GEO
    return COLUMNAS_CAMPANA_BASE


def _mapa_geo() -> tuple[dict[int, dict[str, Any]], dict[int, dict[str, Any]]]:
    """Departamentos y provincias indexados por id."""
    try:
        cols_dep = supabase_rest.columnas("departamento")
        cols_prov = supabase_rest.columnas("provincia")
    except supabase_rest.SupabaseError:
        return {}, {}
    if not cols_dep or not cols_prov:
        return {}, {}
    departamentos = supabase_rest.seleccionar(
        "departamento",
        columnas="id_departamento,id_provincia,nombre",
        limite=1000,
    )
    provincias = supabase_rest.seleccionar(
        "provincia", columnas="id_provincia,nombre", limite=200
    )
    return (
        {d["id_departamento"]: d for d in departamentos},
        {p["id_provincia"]: p for p in provincias},
    )


def _ubicacion_legible(
    fila: dict[str, Any],
    departamentos: dict[int, dict[str, Any]],
    provincias: dict[int, dict[str, Any]],
) -> tuple[str, str | None, int | None, str | None, int | None, str | None]:
    """(localidad_puna, detalle, id_dep, dep, id_prov, prov)."""
    id_dep = fila.get("id_departamento")
    detalle = (fila.get("localidad_detalle") or "").strip() or None
    dep = None
    id_prov = None
    prov = None
    if id_dep is not None:
        d = departamentos.get(int(id_dep), {})
        dep = d.get("nombre")
        id_prov = d.get("id_provincia")
        if id_prov is not None:
            prov = provincias.get(int(id_prov), {}).get("nombre")
    partes = [p for p in [detalle, dep, prov] if p]
    legible = " · ".join(partes) if partes else (fila.get("localidad_puna") or "").strip()
    if not legible:
        legible = "Sin ubicación"
    return legible, detalle, int(id_dep) if id_dep is not None else None, dep, (
        int(id_prov) if id_prov is not None else None
    ), prov


def _campana_out(
    fila: dict[str, Any],
    conteo: dict[int, int],
    departamentos: dict[int, dict[str, Any]],
    provincias: dict[int, dict[str, Any]],
) -> CampanaOut:
    legible, detalle, id_dep, dep, id_prov, prov = _ubicacion_legible(
        fila, departamentos, provincias
    )
    return CampanaOut(
        id_campana=fila["id_campana"],
        localidad_puna=legible,
        id_departamento=id_dep,
        departamento=dep,
        id_provincia=id_prov,
        provincia=prov,
        localidad_detalle=detalle,
        fecha_salida=fila["fecha_salida"],
        convenio_inta=fila["convenio_inta"],
        observaciones=fila.get("observaciones"),
        total_muestras=conteo.get(fila["id_campana"], 0),
        creado_por=fila.get("creado_por"),
        creado_en=fila.get("creado_en"),
    )


def _mapa_campanas() -> dict[int, CampanaOut]:
    campanas = supabase_rest.seleccionar(
        "campana_territorio", columnas=_columnas_campana()
    )
    departamentos, provincias = _mapa_geo()
    return {
        c["id_campana"]: _campana_out(c, {}, departamentos, provincias) for c in campanas
    }


def _muestra_out(fila: dict[str, Any], campanas: dict[int, CampanaOut]) -> MuestraOut:
    campana = campanas.get(fila["id_campana"])
    return MuestraOut(
        id_muestra=fila["id_muestra"],
        id_campana=fila["id_campana"],
        codigo_animal=fila["codigo_animal"],
        especie=fila["especie"],
        fecha_hora_extraccion=fila["fecha_hora_extraccion"],
        url_foto_campo=fila.get("url_foto_campo"),
        primera_corrida=fila.get("primera_corrida"),
        horas_transcurridas=fila["horas_transcurridas"],
        estado_48h=fila["estado_48h"],
        localidad_puna=campana.localidad_puna if campana else "Sin campaña",
        fecha_salida=(
            campana.fecha_salida
            if campana
            else fila["fecha_hora_extraccion"][:10]
        ),
    )


@router.get("/campanas", response_model=list[CampanaOut])
def listar_campanas(
    _usuario: Annotated[UsuarioActual, Depends(usuario_actual)],
):
    """Campañas ordenadas de la más reciente a la más antigua."""
    try:
        campanas = supabase_rest.seleccionar(
            "campana_territorio",
            columnas=_columnas_campana(),
            orden="fecha_salida.desc",
        )
        muestras = supabase_rest.seleccionar("muestra_animal", columnas="id_campana")
        departamentos, provincias = _mapa_geo()
    except (supabase_rest.SupabaseNoConfigurado, supabase_rest.SupabaseError) as error:
        raise _http_error(error) from error

    conteo = Counter(m["id_campana"] for m in muestras)
    return [_campana_out(c, conteo, departamentos, provincias) for c in campanas]


@router.post("/campanas", response_model=CampanaOut, status_code=201)
def crear_campana(
    datos: CampanaIn,
    usuario: Annotated[UsuarioActual, Depends(exigir_escritura)],
):
    """Abre una campaña de muestreo en territorio."""
    fila = datos.model_dump(mode="json", exclude_none=False)
    # Compatibilidad: completar localidad_puna legible aunque el cliente use
    # el modelo nuevo. Si hay departamento, se compone tras consultar nombres.
    if not fila.get("localidad_puna"):
        fila["localidad_puna"] = fila.get("localidad_detalle") or "Sin ubicación"
    try:
        # Resolver nombres geográficos para componer localidad_puna.
        if fila.get("id_departamento"):
            dep_id = int(fila["id_departamento"])
            deps = supabase_rest.seleccionar(
                "departamento",
                columnas="id_departamento,id_provincia,nombre",
                filtros=[("id_departamento", f"eq.{dep_id}")],
                limite=1,
            )
            if deps:
                provs = supabase_rest.seleccionar(
                    "provincia",
                    columnas="id_provincia,nombre",
                    filtros=[("id_provincia", f"eq.{deps[0]['id_provincia']}")],
                    limite=1,
                )
                dep_nom = deps[0]["nombre"]
                prov_nom = provs[0]["nombre"] if provs else None
                partes = [p for p in [fila.get("localidad_detalle"), dep_nom, prov_nom] if p]
                fila["localidad_puna"] = " · ".join(partes)
            else:
                raise HTTPException(422, "El departamento elegido no existe")

        # No enviar columnas que aún no existen (migración 005 pendiente).
        try:
            cols = supabase_rest.columnas("campana_territorio")
        except supabase_rest.SupabaseError:
            cols = set()
        fila = {k: v for k, v in fila.items() if k in cols or not cols}
        supabase_rest.con_auditoria("campana_territorio", fila, usuario.id)
        creadas = supabase_rest.insertar("campana_territorio", [fila])
        departamentos, provincias = _mapa_geo()
    except HTTPException:
        raise
    except (supabase_rest.SupabaseNoConfigurado, supabase_rest.SupabaseError) as error:
        raise _http_error(error) from error

    if not creadas:
        raise HTTPException(502, "Supabase no devolvió la campaña creada")
    return _campana_out(creadas[0], {}, departamentos, provincias)


@router.get("/muestras", response_model=list[MuestraOut])
def listar_muestras(
    _usuario: Annotated[UsuarioActual, Depends(usuario_actual)],
    id_campana: int | None = Query(None, gt=0),
    estado: EstadoMuestra | None = Query(None),
    limite: int = Query(500, ge=1, le=2000),
):
    """Muestras con su semáforo, opcionalmente filtradas."""
    filtros: list[tuple[str, str]] = []
    if id_campana is not None:
        filtros.append(("id_campana", f"eq.{id_campana}"))
    if estado is not None:
        filtros.append(("estado_48h", f"eq.{estado}"))

    try:
        filas = supabase_rest.seleccionar(
            "muestra_con_estado",
            filtros=filtros,
            orden="fecha_hora_extraccion.desc",
            limite=limite,
        )
        campanas = _mapa_campanas()
    except (supabase_rest.SupabaseNoConfigurado, supabase_rest.SupabaseError) as error:
        raise _http_error(error) from error

    return [_muestra_out(fila, campanas) for fila in filas]


@router.get("/muestras/{id_muestra}", response_model=MuestraOut)
def obtener_muestra(
    id_muestra: int,
    _usuario: Annotated[UsuarioActual, Depends(usuario_actual)],
):
    """Una muestra puntual."""
    try:
        filas = supabase_rest.seleccionar(
            "muestra_con_estado",
            filtros=[("id_muestra", f"eq.{id_muestra}")],
            limite=1,
        )
        if not filas:
            raise HTTPException(404, "La muestra no existe")
        campanas = _mapa_campanas()
        return _muestra_out(filas[0], campanas)
    except HTTPException:
        raise
    except (supabase_rest.SupabaseNoConfigurado, supabase_rest.SupabaseError) as error:
        raise _http_error(error) from error


@router.post("/muestras", response_model=MuestraOut, status_code=201)
def crear_muestra(
    datos: MuestraIn,
    usuario: Annotated[UsuarioActual, Depends(exigir_escritura)],
):
    """Registra una muestra y devuelve su estado actual del semáforo."""
    fila = datos.model_dump(mode="json")
    try:
        supabase_rest.con_auditoria("muestra_animal", fila, usuario.id)
        creadas = supabase_rest.insertar("muestra_animal", [fila])
        if not creadas:
            raise HTTPException(502, "Supabase no devolvió la muestra creada")

        id_muestra = creadas[0]["id_muestra"]
        vistas = supabase_rest.seleccionar(
            "muestra_con_estado",
            filtros=[("id_muestra", f"eq.{id_muestra}")],
            limite=1,
        )
        campanas = _mapa_campanas()
    except HTTPException:
        raise
    except supabase_rest.SupabaseError as error:
        raise _error_muestra(error) from error
    except supabase_rest.SupabaseNoConfigurado as error:
        raise _http_error(error) from error

    return _muestra_out(vistas[0] if vistas else creadas[0], campanas)
