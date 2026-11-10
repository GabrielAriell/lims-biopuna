"""Autenticación con Supabase Auth desde el backend.

El navegador nunca recibe la secret key del proyecto. El frontend manda
correo y contraseña a estos endpoints, y el backend habla con GoTrue
(``/auth/v1``) usando la clave de servicio. El token que devuelve Supabase se
guarda en el navegador y viaja en ``Authorization: Bearer ...`` en cada
llamada a la API.

Este módulo no debe importarse desde el navegador.
"""
from __future__ import annotations

from typing import Any

import httpx

from app.services import supabase_rest

TIEMPO_LIMITE = 15.0

# Mensajes de GoTrue traducidos para que el login sea claro.
_MENSAJES = {
    "invalid_credentials": "Correo o contraseña incorrectos",
    "email_not_confirmed": "El correo todavía no está confirmado",
    "user_not_found": "No existe una cuenta con ese correo",
    "weak_password": "La contraseña es demasiado débil",
}


class AuthError(RuntimeError):
    """Supabase Auth rechazó la operación."""

    def __init__(self, mensaje: str, status: int = 401) -> None:
        super().__init__(mensaje)
        self.status = status


def _pedir(metodo: str, ruta: str, **kwargs: Any) -> dict[str, Any]:
    """Llama a GoTrue agregando las credenciales del backend."""
    base, clave = supabase_rest.conexion()
    cabeceras = dict(kwargs.pop("headers", {}) or {})
    cabeceras.setdefault("apikey", clave)
    cabeceras.setdefault("Authorization", f"Bearer {clave}")
    cabeceras.setdefault("Content-Type", "application/json")

    try:
        respuesta = httpx.request(
            metodo,
            f"{base}{ruta}",
            headers=cabeceras,
            timeout=TIEMPO_LIMITE,
            **kwargs,
        )
    except httpx.HTTPError as error:
        raise AuthError(
            f"No se pudo conectar con Supabase Auth: {error}", status=502
        ) from error

    if respuesta.is_error:
        try:
            cuerpo = respuesta.json()
        except ValueError:
            cuerpo = {}
        codigo = str(cuerpo.get("error_code") or cuerpo.get("code") or "")
        mensaje = (
            _MENSAJES.get(codigo)
            or cuerpo.get("msg")
            or cuerpo.get("message")
            or cuerpo.get("error_description")
            or "No se pudo autenticar"
        )
        # Los errores de credenciales son 400 en GoTrue; para el navegador
        # conviene que sean 401.
        status = 401 if respuesta.status_code in (400, 401, 403) else 502
        raise AuthError(str(mensaje), status=status)

    if not respuesta.content:
        return {}
    return respuesta.json()


def _perfil(id_usuario: str) -> dict[str, str]:
    """Datos del investigador vinculados al usuario de Auth."""
    try:
        filas = supabase_rest.seleccionar(
            "investigador",
            columnas="id_investigador,nombre,email,rol_sistema",
            filtros=[("id_investigador", f"eq.{id_usuario}")],
            limite=1,
        )
    except (supabase_rest.SupabaseNoConfigurado, supabase_rest.SupabaseError) as error:
        raise AuthError(str(error), status=502) from error

    if not filas:
        raise AuthError(
            "El usuario existe en Auth pero no tiene perfil de investigador. "
            "Pedile a un administrador que lo cree.",
            status=403,
        )
    fila = filas[0]
    return {
        "id": str(fila["id_investigador"]),
        "nombre": str(fila["nombre"]),
        "email": str(fila["email"]),
        "rol_sistema": str(fila["rol_sistema"]),
    }


def _sesion(datos: dict[str, Any]) -> dict[str, Any]:
    """Normaliza la respuesta de GoTrue para el frontend."""
    usuario = datos.get("user") or {}
    id_usuario = usuario.get("id")
    if not id_usuario:
        raise AuthError("Supabase no devolvió el usuario de la sesión", status=502)
    return {
        "access_token": datos["access_token"],
        "refresh_token": datos["refresh_token"],
        "expires_in": int(datos.get("expires_in") or 3600),
        "token_type": datos.get("token_type") or "bearer",
        "usuario": _perfil(str(id_usuario)),
    }


def iniciar_sesion(email: str, password: str) -> dict[str, Any]:
    """Valida correo y contraseña contra Supabase Auth."""
    datos = _pedir(
        "POST",
        "/auth/v1/token",
        params={"grant_type": "password"},
        json={"email": email, "password": password},
    )
    return _sesion(datos)


def refrescar(refresh_token: str) -> dict[str, Any]:
    """Renueva un access token vencido sin pedir la contraseña otra vez."""
    datos = _pedir(
        "POST",
        "/auth/v1/token",
        params={"grant_type": "refresh_token"},
        json={"refresh_token": refresh_token},
    )
    return _sesion(datos)


def cerrar_sesion(access_token: str) -> None:
    """Revoca el token en Supabase. Si ya venció, no es un error grave."""
    try:
        _pedir(
            "POST",
            "/auth/v1/logout",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    except AuthError as error:
        # Un token vencido no impide cerrar la sesión local.
        if error.status not in (401, 403):
            raise


def usuario_de_token(access_token: str) -> dict[str, str]:
    """Devuelve el perfil del dueño de un access token válido."""
    datos = _pedir(
        "GET",
        "/auth/v1/user",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    id_usuario = datos.get("id")
    if not id_usuario:
        raise AuthError("Token de sesión inválido")
    return _perfil(str(id_usuario))
