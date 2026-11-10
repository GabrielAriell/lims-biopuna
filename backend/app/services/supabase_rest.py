"""Acceso mínimo a Supabase (PostgREST) desde el backend.

Se usa la clave ``service_role``: salta las políticas RLS, por eso este
módulo es exclusivamente del servidor y nunca debe importarse desde el
navegador. Las credenciales se leen de ``backend/.env``.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import httpx
from dotenv import dotenv_values, load_dotenv

# backend/app/services/supabase_rest.py -> backend/.env
RUTA_ENV = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(RUTA_ENV)

TIEMPO_LIMITE = 15.0


def _entorno() -> dict[str, str]:
    """Lee las credenciales de ``backend/.env`` en cada llamada.

    ``load_dotenv`` solo aplica al importar el módulo y el auto-reload de
    uvicorn no siempre detecta los cambios de ``.env``. Leer el archivo en
    cada verificación permite cambiar la clave sin reiniciar el servidor.
    """
    valores = dotenv_values(RUTA_ENV) if RUTA_ENV.exists() else {}
    return {
        "SUPABASE_URL": (
            valores.get("SUPABASE_URL") or os.getenv("SUPABASE_URL") or ""
        ).strip(),
        "SUPABASE_SERVICE_ROLE_KEY": (
            valores.get("SUPABASE_SERVICE_ROLE_KEY")
            or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            or ""
        ).strip(),
    }


class SupabaseNoConfigurado(RuntimeError):
    """Faltan las variables de entorno de Supabase."""


class SupabaseError(RuntimeError):
    """Supabase respondió con un error."""

    def __init__(
        self, mensaje: str, status: int = 502, codigo: str | None = None
    ) -> None:
        super().__init__(mensaje)
        self.status = status
        self.codigo = codigo


def configurado() -> bool:
    """True si hay URL y una clave apta para el backend.

    La clave ``sb_publishable_...`` es pública (equivale a la anon) y no
    sirve para que el backend se salte RLS.
    """
    entorno = _entorno()
    url = entorno["SUPABASE_URL"]
    clave = entorno["SUPABASE_SERVICE_ROLE_KEY"]
    return bool(url and clave and not clave.startswith("sb_publishable_"))


def aviso_configuracion() -> str | None:
    """Mensaje claro para /health cuando falta o no sirve la configuración."""
    entorno = _entorno()
    url = entorno["SUPABASE_URL"]
    clave = entorno["SUPABASE_SERVICE_ROLE_KEY"]
    if not url or not clave:
        return "Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en backend/.env"
    if clave.startswith("sb_publishable_"):
        return (
            "La clave cargada es la publishable (pública). Para el backend "
            "necesitás la secret key (sb_secret_...) o la service_role key."
        )
    return None


def _base_y_clave() -> tuple[str, str]:
    entorno = _entorno()
    url = entorno["SUPABASE_URL"].rstrip("/")
    clave = entorno["SUPABASE_SERVICE_ROLE_KEY"]
    if not url or not clave:
        raise SupabaseNoConfigurado(
            "Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en backend/.env"
        )
    if clave.startswith("sb_publishable_"):
        raise SupabaseNoConfigurado(
            "La clave cargada es la publishable (pública). Para el backend "
            "necesitás la secret key (sb_secret_...) o la service_role key."
        )
    return url, clave


def conexion() -> tuple[str, str]:
    """URL y secret key del proyecto (solo para uso interno del backend)."""
    return _base_y_clave()


# Columnas conocidas por tabla. PostgREST publica su esquema en la raíz de
# /rest/v1; se cachea brevemente para tolerar migraciones recién ejecutadas.
import time

_ESQUEMA: tuple[float, dict[str, set[str]]] | None = None
_TTL_ESQUEMA = 30.0


def _esquema() -> dict[str, set[str]]:
    global _ESQUEMA
    ahora = time.monotonic()
    if _ESQUEMA and ahora - _ESQUEMA[0] < _TTL_ESQUEMA:
        return _ESQUEMA[1]
    base, _ = _base_y_clave()
    try:
        respuesta = httpx.get(
            f"{base}/rest/v1/", headers=_cabeceras(), timeout=TIEMPO_LIMITE
        )
        respuesta.raise_for_status()
        especificacion = respuesta.json()
    except (httpx.HTTPError, ValueError) as error:
        raise SupabaseError(
            f"No se pudo leer el esquema de Supabase: {error}"
        ) from error
    definiciones = especificacion.get("definitions") or (
        especificacion.get("components", {}).get("schemas", {})
    )
    mapa = {
        tabla: set(info.get("properties", {}))
        for tabla, info in definiciones.items()
        if isinstance(info, dict)
    }
    _ESQUEMA = (ahora, mapa)
    return mapa


def columnas(tabla: str) -> set[str]:
    """Nombres de columna que PostgREST conoce para ``tabla``."""
    return _esquema().get(tabla, set())


def con_auditoria(
    tabla: str, fila: dict[str, Any], id_usuario: str
) -> dict[str, Any]:
    """Agrega ``creado_por`` si la migración de auditoría ya se ejecutó.

    Así la app sigue funcionando antes de correr 004_auditoria.sql y empieza
    a registrar el creador automáticamente después.
    """
    if "creado_por" in columnas(tabla):
        fila["creado_por"] = id_usuario
    return fila


def _cabeceras(prefer: str | None = None) -> dict[str, str]:
    _, clave = _base_y_clave()
    cabeceras = {
        "apikey": clave,
        "Authorization": f"Bearer {clave}",
        "Content-Type": "application/json",
    }
    if prefer:
        cabeceras["Prefer"] = prefer
    return cabeceras


def _error(respuesta: httpx.Response) -> SupabaseError:
    """Traduce el JSON de error de PostgREST a una excepción legible."""
    try:
        cuerpo = respuesta.json()
    except ValueError:
        cuerpo = {}
    mensaje = cuerpo.get("message") or cuerpo.get("details") or respuesta.text
    # 400/409 suelen ser datos inválidos o choques de claves únicas.
    status = respuesta.status_code if 400 <= respuesta.status_code < 500 else 502
    return SupabaseError(
        str(mensaje).strip() or "Error de Supabase",
        status,
        cuerpo.get("code"),
    )


def _pedir(metodo: str, tabla: str, **kwargs: Any) -> Any:
    base, _ = _base_y_clave()
    url = f"{base}/rest/v1/{tabla}"
    try:
        respuesta = httpx.request(metodo, url, timeout=TIEMPO_LIMITE, **kwargs)
    except httpx.HTTPError as error:
        raise SupabaseError(f"No se pudo conectar con Supabase: {error}") from error
    if respuesta.is_error:
        raise _error(respuesta)
    if not respuesta.content:
        return None
    return respuesta.json()


def seleccionar(
    tabla: str,
    *,
    columnas: str = "*",
    filtros: list[tuple[str, str]] | None = None,
    orden: str | None = None,
    limite: int | None = None,
) -> list[dict[str, Any]]:
    """Lee filas de una tabla o vista.

    ``filtros`` usa la sintaxis de PostgREST, por ejemplo
    ``[("id_campana", "eq.3")]``.
    """
    parametros: list[tuple[str, str]] = [("select", columnas)]
    parametros.extend(filtros or [])
    if orden:
        parametros.append(("order", orden))
    if limite is not None:
        parametros.append(("limit", str(limite)))
    filas = _pedir("GET", tabla, headers=_cabeceras(), params=parametros)
    return filas or []


def insertar(tabla: str, filas: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Inserta una o más filas y devuelve lo que guardó la base."""
    creadas = _pedir(
        "POST",
        tabla,
        headers=_cabeceras("return=representation"),
        params=[("select", "*")],
        json=filas,
    )
    return creadas or []


def eliminar(tabla: str, filtros: list[tuple[str, str]]) -> None:
    """Borra las filas que cumplen los filtros de PostgREST.

    Se usa para deshacer una inserción cuando falla un paso posterior, porque
    PostgREST no ofrece transacciones entre varias llamadas.
    """
    _pedir("DELETE", tabla, headers=_cabeceras(), params=list(filtros))
