"""Gestión administrativa de usuarios (investigadores) y acceso.

Opera con la secret key del backend: crea usuarios en Supabase Auth (Admin API)
y mantiene su perfil/rol en la tabla `investigador`. Nunca debe ejecutarse en el
navegador.
"""
from __future__ import annotations

from typing import Any

import httpx

from app.schemas.usuarios import UsuarioActualizarIn, UsuarioCrearIn
from app.services import supabase_rest

TIEMPO_LIMITE = 20.0
COLUMNAS = "id_investigador,nombre,email,rol_sistema"


class UsuarioAdminError(RuntimeError):
    """Operación administrativa rechazada."""

    def __init__(self, mensaje: str, status: int = 400) -> None:
        super().__init__(mensaje)
        self.status = status


def _cabeceras_admin() -> tuple[str, dict[str, str]]:
    base, clave = supabase_rest.conexion()
    return base, {
        "apikey": clave,
        "Authorization": f"Bearer {clave}",
        "Content-Type": "application/json",
    }


def _mensaje_auth(respuesta: httpx.Response) -> str:
    try:
        cuerpo = respuesta.json()
    except ValueError:
        cuerpo = {}
    codigo = str(cuerpo.get("error_code") or cuerpo.get("code") or "")
    mensaje = (
        cuerpo.get("msg")
        or cuerpo.get("message")
        or cuerpo.get("error_description")
        or cuerpo.get("error")
        or "No se pudo completar la operación en Supabase Auth"
    )
    texto = str(mensaje)
    if codigo in {"email_exists", "user_already_exists"} or "already" in texto.lower():
        return "Ya existe un usuario con ese correo"
    if "password" in texto.lower() and (
        "weak" in texto.lower() or "least" in texto.lower() or "6" in texto
    ):
        return "La contraseña no cumple los requisitos mínimos"
    return texto


def listar() -> list[dict[str, Any]]:
    return supabase_rest.seleccionar(
        "investigador", columnas=COLUMNAS, orden="nombre.asc"
    )


def _contar_admins() -> int:
    admins = supabase_rest.seleccionar(
        "investigador",
        columnas="id_investigador",
        filtros=[("rol_sistema", "eq.admin")],
    )
    return len(admins)


def actualizar(
    id_usuario: str, datos: UsuarioActualizarIn, id_admin_actual: str
) -> dict[str, Any]:
    actuales = supabase_rest.seleccionar(
        "investigador",
        columnas=COLUMNAS,
        filtros=[("id_investigador", f"eq.{id_usuario}")],
        limite=1,
    )
    if not actuales:
        raise UsuarioAdminError("El usuario no existe", status=404)
    actual = actuales[0]
    rol_actual = str(actual.get("rol_sistema") or "")

    cambios: dict[str, Any] = {}
    if datos.nombre is not None:
        cambios["nombre"] = datos.nombre
    if datos.rol_sistema is not None:
        cambios["rol_sistema"] = datos.rol_sistema

    if not cambios:
        raise UsuarioAdminError("No se indicaron cambios para guardar", status=400)

    nuevo_rol = cambios.get("rol_sistema", rol_actual)
    if rol_actual == "admin" and nuevo_rol != "admin":
        if id_usuario == id_admin_actual:
            raise UsuarioAdminError(
                "No podés quitarte tu propio rol de administrador", status=400
            )
        if _contar_admins() <= 1:
            raise UsuarioAdminError(
                "No se puede quitar el rol al último administrador del sistema",
                status=400,
            )

    actualizados = supabase_rest.actualizar(
        "investigador", cambios, [("id_investigador", f"eq.{id_usuario}")]
    )
    if not actualizados:
        # Releer por si el perfil existe pero el update no devolvió representación.
        filas = supabase_rest.seleccionar(
            "investigador",
            columnas=COLUMNAS,
            filtros=[("id_investigador", f"eq.{id_usuario}")],
            limite=1,
        )
        if not filas:
            raise UsuarioAdminError("El usuario no existe", status=404)
        return filas[0]
    fila = actualizados[0]
    return {
        "id_investigador": fila.get("id_investigador"),
        "nombre": fila.get("nombre"),
        "email": fila.get("email"),
        "rol_sistema": fila.get("rol_sistema"),
    }


def _crear_en_auth(email: str, password: str, nombre: str) -> str:
    base, cabeceras = _cabeceras_admin()
    try:
        respuesta = httpx.post(
            f"{base}/auth/v1/admin/users",
            headers=cabeceras,
            json={
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {"nombre": nombre},
            },
            timeout=TIEMPO_LIMITE,
        )
    except httpx.HTTPError as error:
        raise UsuarioAdminError(
            f"No se pudo conectar con Supabase Auth: {error}", status=502
        ) from error

    if respuesta.is_error:
        status = 400 if 400 <= respuesta.status_code < 500 else 502
        raise UsuarioAdminError(_mensaje_auth(respuesta), status=status)

    try:
        cuerpo = respuesta.json()
    except ValueError as error:
        raise UsuarioAdminError(
            "Supabase Auth devolvió una respuesta inválida", status=502
        ) from error
    user_id = cuerpo.get("id")
    if not user_id:
        raise UsuarioAdminError(
            "Supabase Auth no devolvió el identificador del usuario", status=502
        )
    return str(user_id)


def crear(datos: UsuarioCrearIn) -> dict[str, Any]:
    user_id = _crear_en_auth(datos.email, datos.password, datos.nombre)

    # El trigger al_crear_usuario crea el perfil con rol 'lectura' y nombre por
    # defecto; lo ajustamos al rol/nombre elegidos por el administrador.
    perfil = {
        "nombre": datos.nombre,
        "email": datos.email,
        "rol_sistema": datos.rol_sistema,
    }
    try:
        actualizados = supabase_rest.actualizar(
            "investigador", perfil, [("id_investigador", f"eq.{user_id}")]
        )
        if actualizados:
            fila = actualizados[0]
        else:
            # Si el trigger aún no creó el perfil, lo insertamos explícitamente.
            creados = supabase_rest.insertar(
                "investigador",
                [{"id_investigador": user_id, **perfil}],
            )
            fila = creados[0] if creados else None
    except (supabase_rest.SupabaseError, supabase_rest.SupabaseNoConfigurado):
        # El usuario ya existe en Auth; el perfil puede haberse creado por trigger.
        filas = supabase_rest.seleccionar(
            "investigador",
            columnas=COLUMNAS,
            filtros=[("id_investigador", f"eq.{user_id}")],
            limite=1,
        )
        fila = filas[0] if filas else None

    if not fila:
        raise UsuarioAdminError(
            "El usuario se creó en Auth pero no se pudo preparar su perfil de investigador",
            status=502,
        )

    return {
        "id_investigador": fila.get("id_investigador", user_id),
        "nombre": fila.get("nombre", datos.nombre),
        "email": fila.get("email", datos.email),
        "rol_sistema": fila.get("rol_sistema", datos.rol_sistema),
    }
